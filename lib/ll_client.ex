defmodule Jellygrinder.LLClient do
  @moduledoc false

  use GenServer, restart: :temporary

  @max_partial_request_count 12
  @max_single_partial_request_retries 3

  # in ms
  @default_wait_period 1000

  @spec start_link(%{url: String.t(), parent: GenServer.server(), name: String.t()}) ::
          GenServer.on_start()
  def start_link(opts) do
    GenServer.start_link(__MODULE__, opts)
  end

  @impl true
  def init(opts) do
    master_manifest_uri = URI.parse(opts.url)

    state = %{
      name: opts.name,
      parent: opts.parent,
      base_uri: Map.update!(master_manifest_uri, :path, &Path.dirname/1),
      track_manifest_name: nil,
      latest_partial: nil
    }

    {:ok, state, {:continue, {:get_master_manifest, master_manifest_uri}}}
  end

  @impl true
  def handle_continue({:get_master_manifest, uri}, state) do
    case request(uri, "master playlist", state.name, state.parent) do
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
    latest_partial =
      case request_track_manifest(state) do
        {:ok, track_manifest} ->
          track_manifest
          |> get_new_partials_info(state.latest_partial)
          |> Enum.reduce(state.latest_partial, fn partial, _acc ->
            request_partial(partial, state)
          end)

        {:error, _response} ->
          state.latest_partial
      end

    wait_for =
      if is_nil(latest_partial),
        do: @default_wait_period,
        else: floor(latest_partial.duration * 1000)

    Process.send_after(self(), :get_new_partials, wait_for)

    {:noreply, %{state | latest_partial: latest_partial}}
  end

  @impl true
  def handle_info(_msg, state) do
    {:noreply, state}
  end

  defp request_track_manifest(state) do
    state.base_uri
    |> Map.update!(:path, &Path.join(&1, state.track_manifest_name))
    |> request("media playlist", state.name, state.parent)
  end

  defp request_partial(partial, state, retries \\ @max_single_partial_request_retries)

  defp request_partial(partial, _state, 0) do
    partial
  end

  defp request_partial(partial, state, retries) do
    {status, _content} =
      state.base_uri
      |> Map.update!(:path, &Path.join(&1, partial.name))
      |> request("media partial segment", state.name, state.parent)

    case status do
      :ok -> partial
      :error -> request_partial(partial, state, retries - 1)
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

  defp request(url, label, process_name, parent) do
    url = if(is_binary(url), do: url, else: URI.to_string(url))

    timestamp = get_current_timestamp_ms()
    maybe_response = Finch.build(:get, url) |> Finch.request(Jellygrinder.Finch)
    elapsed = get_current_timestamp_ms() - timestamp

    request_info = %{
      timestamp: timestamp,
      elapsed: elapsed,
      label: label,
      process_name: process_name,
      url: url
    }

    {result, body} =
      case maybe_response do
        {:ok, response} ->
          success = response.status == 200

          {%{
             response_code: response.status,
             success: success,
             failure_msg: if(success, do: "", else: response.body),
             bytes: byte_size(response.body)
           }, response.body}

        {:error, reason} ->
          {%{
             response_code: -1,
             success: false,
             failure_msg: inspect(reason),
             bytes: -1
           }, ""}
      end

    send(parent, {:result, Map.merge(request_info, result)})

    {if(result.success, do: :ok, else: :error), body}
  end

  defp get_current_timestamp_ms() do
    {megaseconds, seconds, microseconds} = :os.timestamp()

    megaseconds * 1_000_000_000 + seconds * 1000 + div(microseconds, 1000)
  end
end
