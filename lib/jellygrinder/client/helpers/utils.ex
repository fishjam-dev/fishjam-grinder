defmodule Jellygrinder.Client.Helpers.Utils do
  @moduledoc false

  alias Jellygrinder.Client.Helpers.ConnectionManager
  alias Jellygrinder.Coordinator

  @spec request(String.t(), String.t(), map()) :: {:ok | :error, binary()}
  def request(path, label, state) do
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

    GenServer.cast(Coordinator, {:result, Map.merge(request_info, result)})

    {if(result.success, do: :ok, else: :error), data}
  end

  @spec get_track_manifest_name(String.t()) :: String.t()
  def get_track_manifest_name(master_manifest) do
    master_manifest
    |> String.split("\n")
    |> List.last()
  end

  defp get_current_timestamp_ms() do
    {megaseconds, seconds, microseconds} = :os.timestamp()

    megaseconds * 1_000_000_000 + seconds * 1000 + div(microseconds, 1000)
  end
end
