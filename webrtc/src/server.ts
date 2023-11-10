const { createServer } = require("vite");

export const startServer = async ({
  jellyfishAddress,
  secure,
}: {
  jellyfishAddress: string;
  secure: boolean;
}) => {
  process.env;

  const server = await createServer({
    // any valid user config options, plus `mode` and `configFile`
    configFile: false,
    root: "./frontend",
    server: {
      port: 5005,
    },
    define: {
      "process.env.JF_ADDR": JSON.stringify(jellyfishAddress),
      "process.env.JF_PROTOCOL": JSON.stringify(secure ? "wss" : "ws"),
    },
  });
  await server.listen();

  server.printUrls();
};
