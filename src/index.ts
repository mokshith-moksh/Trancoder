import express from "express";
import { exec } from "child_process";
import AWS from "aws-sdk";
import fs from "fs";
import path from "path";
import * as dotenv from "dotenv";
dotenv.config();
const app = express();
const port = 3000;

AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

const s3 = new AWS.S3();
const bucketName = process.env.S3_BUCKET_NAME;

app.use(express.json());

function generateUniqueFilename(filename: any) {
  const timestamp = Date.now();
  const randomString = Math.random().toString(36).substring(7);
  const extension = path.extname(filename);
  return `${timestamp}_${randomString}${extension}`;
}

app.post("/transcode", (req, res) => {
  console.log("Started");
  const inputUrl = req.body.inputUrl;
  if (!inputUrl) {
    return res.status(400).send("Input URL is required.");
  }
  const command = `ffmpeg -i ${inputUrl} \
  -vf "scale=1280:720" -c:a aac -b:a 128k -c:v libx264 -b:v 1500k -f dash ${generateUniqueFilename(
    "720p.mpd"
  )} \
  -vf "scale=854:480" -c:a aac -b:a 128k -c:v libx264 -b:v 1000k -f dash ${generateUniqueFilename(
    "480p.mpd"
  )} \
  -vf "scale=256:144" -c:a aac -b:a 64k -c:v libx264 -b:v 200k -f dash ${generateUniqueFilename(
    "144p.mpd"
  )}`;

  exec(command, async (error, stdout, stderr) => {
    if (error) {
      console.error(`Error: ${error.message}`);
      return res.status(500).send("Transcoding failed.");
    }
    if (stderr) {
      console.error(`stderr: ${stderr}`);
      return res.status(500).send("Transcoding failed.");
    }
    console.log("Transcoding complete!");

    try {
      const uploadPromises = ["720p.mpd", "480p.mpd", "144p.mpd"].map(
        async (filename) => {
          const fileStream = fs.createReadStream(filename);
          const uniqueFilename = generateUniqueFilename(filename);

          await s3
            .upload({
              Bucket: bucketName || "",
              Key: uniqueFilename,
              Body: fileStream,
            })
            .promise();

          console.log(`${filename} uploaded to S3 as ${uniqueFilename}`);
        }
      );

      await Promise.all(uploadPromises);
      res.send("Transcoding complete!");
    } catch (err) {
      console.error("Error uploading files to S3:", err);
      res.status(500).send("Error uploading files to S3.");
    }
  });
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
