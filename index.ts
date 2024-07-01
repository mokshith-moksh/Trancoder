import { exec } from "child_process";
import util from 'util';
import * as dotenv from "dotenv";
import {
    S3Client,
    PutObjectCommand,
} from "@aws-sdk/client-s3";
import fs from 'fs';
import path from 'path';

dotenv.config();

const s3 = new S3Client({
    region: 'auto',
    endpoint: `${process.env.END_POINT}`,
    credentials: {
        accessKeyId: `${process.env.ACCESS_KEY_ID}`,
        secretAccessKey: `${process.env.SECRET_ACCESS_KEY}`,
    },
});

// Convert exec to promise-based
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
        console.log(`File uploaded successfully`);
        console.log(JSON.stringify(data, null, 2));
    } catch (err) {
        console.error(`Error uploading file: ${err}`);
    }
}

async function uploadDirectoryToS3(dirPath:any, bucketName:any, baseKey = 'test1') {
    const files = fs.readdirSync(dirPath);

    for (const file of files) {
        const filePath = path.join(dirPath, file);
        const fileKey = path.join(baseKey, file);
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

    const command = `ffmpeg -i ${inputUrl} -map 0 -map 0 -c:a aac -strict -2 -c:v libx264 -min_seg_duration 2000 -window_size 5 -extra_window_size 5 -use_template 1 -use_timeline 1 -f dash -adaptation_sets "id=0,streams=v id=1,streams=a" -b:v:0 800k -b:v:1 1500k -s:v:0 854x480 -s:v:1 1280x720 ./final/${filename}.mpd`;

    try {
        await execPromise(command); // Use the promise-based exec
        console.log("Transcoding Success");
    } catch (error) {
        console.error(`Transcoding Error: ${error}`);
    }
}

main();
