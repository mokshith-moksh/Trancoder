import { exec } from "child_process";
import util from 'util'; // Step 1: Import util
import * as dotenv from "dotenv";
import {
    S3Client,
    ListBucketsCommand,
    PutObjectCommand,
} from "@aws-sdk/client-s3";
import fs from 'fs';
import path from 'path';

dotenv.config();

const s3 = new S3Client({
    region: 'auto',
    endpoint: `https://eade2f9368bc5fef4fa120312a02e3ae.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: `56e2a918c07d63156b555e37f467b39f`,
        secretAccessKey: `0b5412fccf03f95c5f875bcaf91e7bc170ea58d288027f8f3eb26c68d54f8768`,
    },
});

// Step 2: Convert exec to promise-based
const execPromise = util.promisify(exec);

async function main() {
    await startTranscoding();
    await uploadToR2();
    console.log("Uploading done");
}

async function uploadFileToS3(filePath:any, bucketName:any, key:any) {
    const fileContent = fs.readFileSync(filePath);

    const uploadParams = {
        Bucket: bucketName,
        Key: key,
        Body: fileContent,
    };

    try {
        const data = await s3.send(new PutObjectCommand(uploadParams));
        console.log(`File uploaded successfully. ${data}`);
    } catch (err) {
        console.error(`Error uploading file: ${err}`);
    }
}

async function uploadDirectoryToS3(dirPath:any, bucketName:any, baseKey = 'mokshith') {
    const files = fs.readdirSync(dirPath);

    for (const file of files) {
        const filePath = path.join(dirPath, file);
        const fileKey = path.join(baseKey, file);
        console.log("files are uploading")
        if (fs.lstatSync(filePath).isDirectory()) {
            await uploadDirectoryToS3(filePath, bucketName, fileKey);
        } else {
            await uploadFileToS3(filePath, bucketName, fileKey);
        }
    }
}

async function uploadToR2() {
    const dirPath = './final'; // Directory containing the files to upload
    const bucketName = 'bucket1'; // Replace with your S3 bucket name
    console.log(
        await s3.send(
          new ListBucketsCommand('')
        )
      );
    console.log("started to upload the directory")
    await uploadDirectoryToS3(dirPath, bucketName);
}

async function startTranscoding() {
    console.log("Started");

    const inputUrl = process.env.INPUT_URL;
    const filename = process.env.FILENAME;

    if (!inputUrl ||!filename) {
        console.error("Input and fileName URL is required.");
        return;
    }

    const command = `ffmpeg -i ${inputUrl} -map 0 -map 0 -c:a aac -strict -2 -c:v libx264 -min_seg_duration 2000 -window_size 5 -extra_window_size 5 -use_template 1 -use_timeline 1 -f dash -adaptation_sets "id=0,streams=v id=1,streams=a" -b:v:0 800k -b:v:1 1500k -s:v:0 854x480 -s:v:1 1280x720./final/${filename}.mpd`;

    try {
        await execPromise(command); // Use the promise-based exec
        console.log("Transcoding Success");
    } catch (error) {
        console.error(`Transcoding Error: ${error}`);
    }
}

main();
