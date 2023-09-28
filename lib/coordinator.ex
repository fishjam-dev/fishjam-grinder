defmodule Jellygrinder.Coordinator do
  @moduledoc false

  use GenServer, restart: :temporary
  require Logger
  alias Jellygrinder.ClientSupervisor

  defmodule Config do
    @moduledoc false

    @default_client_config [
      server_address: "localhost:5002",
      server_api_token: "development",
      secure?: false
    ]

    @type client_config :: Jellyfish.Client.connection_options()
    @type t :: %__MODULE__{
            client_config: client_config(),
            url: String.t() | nil,
            max_clients: pos_integer(),
            max_time: pos_integer(),
            out_path: Path.t()
          }

    defstruct client_config: @default_client_config,
              url: nil,
              max_clients: 500,
              max_time: 300,
              out_path: "results.csv"

    @spec fill_hls_url!(t()) :: t() | no_return()
    def fill_hls_url!(%{url: nil} = config) do
      client_config = Keyword.merge(@default_client_config, config.client_config)
      client = Jellyfish.Client.new(client_config)

      case Jellyfish.Room.get_all(client) do
        {:ok, [room | _rest]} ->
          protocol = if client_config[:secure?], do: "https", else: "http"

          %{
            config
            | url: "#{protocol}://#{client_config[:server_address]}/hls/#{room.id}/index.m3u8"
          }

        {:ok, []} ->
          raise "No rooms present on Jellyfish"

        {:error, reason} ->
          raise "Error communicating with Jellyfish: #{inspect(reason)}"
      end
    end

    def fill_hls_url!(config), do: config
  end

  # in ms
  @spawn_interval 200

  @spec run_test(Config.t()) :: :ok | no_return()
  def run_test(config) do
    Application.ensure_all_started(:finch)

    children = [
      {Finch, name: Jellygrinder.Finch},
      ClientSupervisor,
      {__MODULE__, [config: config, notify: self()]}
    ]

    {:ok, pid} = Supervisor.start_link(children, strategy: :one_for_one)

    receive do
      :end_of_test -> Supervisor.stop(pid)
    end
  end

  @spec start_link(config: Config.t(), notify: pid()) :: GenServer.on_start()
  def start_link(args) do
    GenServer.start_link(__MODULE__, args, name: __MODULE__)
  end

  @impl true
  def init(config: config, notify: notify) do
    config = Config.fill_hls_url!(config)

    Logger.info("""
    Coordinator: Start of test
      URL: #{config.url}
      Max clients: #{config.max_clients}
      Max time: #{config.max_time} s
      Save results to: #{config.out_path}
    """)

    Process.send_after(self(), :end_test, config.max_time * 1000)
    send(self(), :spawn_client)

    state =
      config
      |> Map.from_struct()
      |> Map.merge(%{notify: notify, client_count: 0, results: []})

    {:ok, state}
  end

  @impl true
  def handle_info({:result, r}, %{results: results} = state) do
    r = amend_result(r, state)

    unless r.success do
      Logger.warning(
        "Coordinator: Request failed (from: #{r.process_name}, label: #{r.label}, code: #{r.response_code})"
      )
    end

    {:noreply, %{state | results: [r | results]}}
  end

  @impl true
  def handle_info(:spawn_client, %{client_count: client_count} = state) do
    if client_count >= state.max_clients do
      {:noreply, state}
    else
      Process.send_after(self(), :spawn_client, @spawn_interval)
      name = "client-#{client_count}"

      case ClientSupervisor.spawn_client(%{url: state.url, parent: self(), name: name}) do
        {:ok, pid} ->
          Logger.info("Coordinator: #{name} spawned at #{inspect(pid)}")
          _ref = Process.monitor(pid)

          {:noreply, %{state | client_count: client_count + 1}}

        {:error, reason} ->
          Logger.error("Coordinator: Error spawning #{name}: #{inspect(reason)}")

          {:noreply, state}
      end
    end
  end

  @impl true
  def handle_info(:end_test, state) do
    Logger.info("Coordinator: End of test")

    ClientSupervisor.terminate_clients()

    Logger.info("Coordinator: Generating report...")

    results =
      state.results
      |> Enum.reverse()
      |> Enum.map_join("", &serialize_result/1)

    Logger.info("Coordinator: Saving generated report to #{state.out_path}...")
    File.write!(state.out_path, results_header() <> results)
    Logger.info("Coordinator: Report saved successfully. Exiting")

    send(state.notify, :end_of_test)

    {:stop, :normal, state}
  end

  @impl true
  def handle_info({:DOWN, _ref, :process, pid, reason}, state) do
    Logger.warning("Coordinator: Child process #{inspect(pid)} died: #{inspect(reason)}")
    state = %{state | client_count: state.client_count - 1}

    {:noreply, state}
  end

  @impl true
  def handle_info(_msg, state) do
    {:noreply, state}
  end

  defp amend_result(result, %{client_count: client_count} = _state) do
    Map.put(result, :client_count, client_count)
  end

  defp results_header() do
    "timeStamp,elapsed,label,responseCode,responseMessage,threadName,dataType,success,failureMessage,bytes,sentBytes,grpThreads,allThreads,URL,Latency,IdleTime,Connect\n"
  end

  defp serialize_result(r) do
    "#{r.timestamp},#{r.elapsed},#{r.label},#{r.response_code},,#{r.process_name},,#{r.success},#{r.failure_msg},#{r.bytes},-1,#{r.client_count},#{r.client_count},#{r.url},-1,-1,-1\n"
  end
end
