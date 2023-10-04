defmodule Mix.Tasks.Lltest do
  @shortdoc "Run LL-HLS stress test"
  @moduledoc "TODO writeme"

  use Mix.Task
  alias Jellygrinder.Coordinator

  @impl true
  def run(argv) do
    Application.ensure_all_started(:jellygrinder)

    {opts, _argv, _errors} =
      OptionParser.parse(argv,
        strict: [
          jellyfish_address: :string,
          jellyfish_token: :string,
          secure: :boolean,
          url: :string,
          clients: :integer,
          time: :integer,
          spawn_interval: :integer,
          out_path: :string
        ]
      )

    client_config =
      Enum.reduce(opts, Keyword.new(), fn {key, value}, config ->
        case key do
          :jellyfish_address -> Keyword.put(config, :server_address, value)
          :jellyfish_token -> Keyword.put(config, :server_api_token, value)
          :secure -> Keyword.put(config, :secure?, value)
          _other -> config
        end
      end)

    coordinator_config =
      opts
      |> Keyword.put(:client_config, client_config)
      |> then(&struct(Coordinator.Config, &1))

    Coordinator.run_test(coordinator_config)
  end
end
