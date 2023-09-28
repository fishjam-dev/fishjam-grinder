defmodule Mix.Tasks.Lltest do
  @moduledoc "TODO writeme"
  @shortdoc "Run LL-HLS stress test"

  use Mix.Task
  alias Jellygrinder.Coordinator

  @impl true
  def run(argv) do
    {opts, _, _} =
      OptionParser.parse(argv,
        strict: [
          jellyfish_address: :string,
          jellyfish_token: :string,
          secure: :boolean,
          url: :string,
          max_clients: :integer,
          max_time: :integer,
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
