import pino from "pino";

const isProduction = process.env.NODE_ENV === "production";

const pinoOptions = {
  level: isProduction ? "info" : "debug",
  formatters: {
    level: (label: string) => ({ level: label }),
  },
  ...(!isProduction && {
    transport: {
      target: "pino-pretty",
      options: {
        colorize: true,
      },
    },
  }),
};

const logger = pino(pinoOptions);

export default logger;
