import app from "../server";

export const config = {
  api: {
    bodyParser: false,
    externalResolver: true,
  },
};

export default app;
