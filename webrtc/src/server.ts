const { createServer } = require("vite");

export const startServer = async ({
  jellyfishAddress,
  secure,
}: {
  jellyfishAddress: string;
  secure: boolean;
}) => {
  const server = await createServer({
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
};
