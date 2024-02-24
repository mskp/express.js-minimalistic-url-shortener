import express from "express";
import { connect, Schema, model } from "mongoose";

export const app = express();

app.use(express.json());
app.use(express.static("public"));

const databaseUri =
  process.env.DATABASE_URI ?? "mongodb://127.0.0.1:27017/shawty-url-shortener";

(async () => {
  try {
    await connect(databaseUri);
    console.log("Database connected");
  } catch (error) {
    console.log("Database connection failed", error);
    process.exit(0);
  }
})();

const ShortenedUrl = new model(
  "URL",
  new Schema(
    {
      longUrl: {
        type: String,
        required: true,
      },
      backHalf: {
        type: String,
        required: true,
      },
    },
    { timestamps: true }
  )
);

const isValidUrl = (url) => {
  const urlPattern = /^(https?|ftp):\/\/[^\s/$.?#].[^\s]*$/i;
  return urlPattern.test(url);
};

app.get("/:backHalf", async (req, res) => {
  try {
    const { backHalf } = req.params;

    const data = await ShortenedUrl.findOne({ backHalf }).select({
      _id: 0,
      longUrl: 1,
    });

    if (data?.longUrl) return res.status(301).redirect(data.longUrl);

    res.status(404).json({ message: "Invalid back-half" });
  } catch (error) {
    console.log(error);
    res.sendStatus(500);
  }
});

app.post("/shorten-url", async (req, res) => {
  try {
    const { longUrl, backHalf } = req.body;

    if (!isValidUrl(longUrl)) {
      return res.status(400).json({ error: "Invalid longUrl format" });
    }

    const backHalfPattern = /^[a-zA-Z0-9-]+$/;
    if (!backHalfPattern.test(backHalf)) {
      return res.status(400).json({
        error:
          "Invalid backHalf format. It can only contain letters, numbers, and hyphens.",
      });
    }

    if (backHalf.length > 50) {
      return res.status(400).json({ error: "backHalf is too long" });
    }

    const exists = await ShortenedUrl.findOne({ backHalf });
    if (exists)
      return res.status(409).json({ error: "backHalf already in use" });

    await new ShortenedUrl({ longUrl, backHalf }).save();
    res.sendStatus(201);
  } catch (error) {
    console.error(error);
    if (error.name === "ValidationError") {
      res.status(400).json({ error: error.message });
    } else {
      res.status(500).json({ error: "Internal server error" });
    }
  }
});

export default app;
