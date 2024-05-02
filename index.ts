import express from "express";
import { exec } from "child_process";
import * as dotenv from "dotenv";
dotenv.config();
const app = express();
const port = 3000;

app.use(express.json());

// Function to execute the transcoding command
function startTranscoding() {
  console.log("Started");

  // Access environment variables
  const inputUrl = process.env.INPUT_URL;
  const filename = process.env.FILENAME;

  if (!inputUrl || !filename) {
    console.error("Input and fileName URL is required.");
    return;
  }

  const command = `ffmpeg -i ${inputUrl} -map 0 -map 0 -c:a aac -strict -2 -c:v libx264 -min_seg_duration 2000 -window_size 5 -extra_window_size 5 -use_template 1 -use_timeline 1 -f dash -adaptation_sets "id=0,streams=v id=1,streams=a" -b:v:0 800k -b:v:1 1500k -s:v:0 854x480 -s:v:1 1280x720 ./final/${filename}.mpd`;

  try {
    exec(command, (error) => {
      if (error) {
        console.error(`exec error: ${error}`);
        return;
      }
      console.log("Transcoding complete!");
    });
  } catch (error) {
    console.log(error);
  }
}

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
  // Start transcoding as soon as the server starts
  startTranscoding();
});
