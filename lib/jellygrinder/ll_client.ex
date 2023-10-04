defmodule Jellygrinder.LLClient do
  @moduledoc false

  use GenServer, restart: :temporary
  alias Jellygrinder.LLClient.ConnectionManager

  @max_partial_request_count 12
  @max_single_partial_request_retries 3

  @partials_per_segment 6

  @spec start_link(%{uri: URI.t(), parent: GenServer.server(), name: String.t()}) ::
          GenServer.on_start()
  def start_link(opts) do
    GenServer.start_link(__MODULE__, opts)
  end

  @impl true
  def init(opts) do
    master_manifest_uri = opts.uri
    {:ok, conn_manager} = ConnectionManager.start_link(master_manifest_uri)

    state = %{
      conn_manager: conn_manager,
      name: opts.name,
      parent: opts.parent,
      base_path: Path.dirname(master_manifest_uri.path),
      track_manifest_name: nil,
      latest_partial: nil
    }

    {:ok, state, {:continue, {:get_master_manifest, master_manifest_uri.path}}}
  end

  @impl true
  def handle_continue({:get_master_manifest, path}, state) do
    case request(path, "master playlist", state) do
      {:ok, master_manifest} ->
        send(self(), :get_new_partials)
        track_manifest_name = get_track_manifest_name(master_manifest)

        {:noreply, %{state | track_manifest_name: track_manifest_name}}

      {:error, _response} ->
        {:stop, :missing_master_manifest, state}
    end
  end

  @impl true
  def handle_info(:get_new_partials, state) do
    path = Path.join(state.base_path, state.track_manifest_name)
    query = create_track_manifest_query(state)

    latest_partial =
      case request(path <> query, "media playlist", state) do
        {:ok, track_manifest} ->
          track_manifest
          |> get_new_partials_info(state.latest_partial)
          |> Enum.map(&request_partial(&1, state))
          |> List.last(state.latest_partial)

        {:error, _response} ->
          state.latest_partial
      end

    send(self(), :get_new_partials)

    {:noreply, %{state | latest_partial: latest_partial}}
  end

  @impl true
  def handle_info(_msg, state) do
    {:noreply, state}
  end

  defp create_track_manifest_query(%{latest_partial: nil} = _state), do: ""

  defp create_track_manifest_query(%{latest_partial: latest_partial} = _state) do
    [last_msn, last_part] =
      latest_partial.name
      |> then(
        &Regex.run(~r/^muxed_segment_(\d+)_\w*_(\d+)_part.m4s$/, &1, capture: :all_but_first)
      )
      |> Enum.map(&String.to_integer/1)

    {msn, part} =
      if last_part == @partials_per_segment - 1,
        do: {last_msn + 1, 0},
        else: {last_msn, last_part + 1}

    "?_HLS_msn=#{msn}&_HLS_part=#{part}"
  end

  defp request_partial(partial, state, retries \\ @max_single_partial_request_retries)
  defp request_partial(partial, _state, 0), do: partial

  defp request_partial(partial, state, retries) do
    path = Path.join(state.base_path, partial.name)

    case request(path, "media partial segment", state) do
      {:ok, _content} -> partial
      {:error, _reason} -> request_partial(partial, state, retries - 1)
    end
  end

  defp get_track_manifest_name(master_manifest) do
    master_manifest
    |> String.split("\n")
    |> List.last()
  end

  defp get_new_partials_info(track_manifest, latest_partial) do
    track_manifest
    |> trim_manifest(latest_partial)
    |> then(&Regex.scan(~r/^#EXT-X-PART:DURATION=(.*),URI="(.*)"/m, &1, capture: :all_but_first))
    |> Enum.take(-@max_partial_request_count)
    |> Enum.map(fn [duration, name] -> %{duration: String.to_float(duration), name: name} end)
  end

  defp trim_manifest(manifest, nil) do
    manifest
  end

  # Trim the manifest, returning everything after `partial`
  # If `partial` isn't present, return the entire manifest
  defp trim_manifest(manifest, partial) do
    manifest
    |> String.split(partial.name, parts: 2)
    |> Enum.at(1, manifest)
  end

  defp request(path, label, state) do
    timestamp = get_current_timestamp_ms()
    start_time = System.monotonic_time()
    maybe_response = ConnectionManager.get(state.conn_manager, path)
    end_time = System.monotonic_time()

    request_info = %{
      timestamp: timestamp,
      elapsed: System.convert_time_unit(end_time - start_time, :native, :millisecond),
      label: label,
      process_name: state.name,
      path: path
    }

    {result, data} =
      case maybe_response do
        {:ok, response} ->
          success = response.status == 200
          data = Map.get(response, :data, "")

          {%{
             response_code: response.status,
             success: success,
             failure_msg: if(success, do: "", else: data),
             bytes: byte_size(data)
           }, data}

        {:error, reason} ->
          {%{
             response_code: -1,
             success: false,
             failure_msg: inspect(reason),
             bytes: -1
           }, ""}
      end

    send(state.parent, {:result, Map.merge(request_info, result)})

    {if(result.success, do: :ok, else: :error), data}
  end

  defp get_current_timestamp_ms() do
    {megaseconds, seconds, microseconds} = :os.timestamp()

    megaseconds * 1_000_000_000 + seconds * 1000 + div(microseconds, 1000)
  end
end
