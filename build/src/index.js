"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const child_process_1 = require("child_process");
const aws_sdk_1 = __importDefault(require("aws-sdk"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const dotenv = __importStar(require("dotenv"));
dotenv.config();
const app = (0, express_1.default)();
const port = 3000;
aws_sdk_1.default.config.update({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION,
});
const s3 = new aws_sdk_1.default.S3();
const bucketName = process.env.S3_BUCKET_NAME;
app.use(express_1.default.json());
function generateUniqueFilename(filename) {
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(7);
    const extension = path_1.default.extname(filename);
    return `${timestamp}_${randomString}${extension}`;
}
app.post("/transcode", (req, res) => {
    const inputUrl = req.body.inputUrl;
    if (!inputUrl) {
        return res.status(400).send("Input URL is required.");
    }
    const command = `ffmpeg -i ${inputUrl} \
        -vf "scale=1280:720" -c:a aac -b:a 128k -c:v libx264 -b:v 1500k -f dash ${generateUniqueFilename("720p.mpd")} \
        -vf "scale=854:480" -c:a aac -b:a 128k -c:v libx264 -b:v 1000k -f dash ${generateUniqueFilename("480p.mpd")} \
        -vf "scale=256:144" -c:a aac -b:a 64k -c:v libx264 -b:v 200k -f dash ${generateUniqueFilename("144p.mpd")}`;
    (0, child_process_1.exec)(command, async (error, stdout, stderr) => {
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
            const uploadPromises = ["720p.mpd", "480p.mpd", "144p.mpd"].map(async (filename) => {
                const fileStream = fs_1.default.createReadStream(filename);
                const uniqueFilename = generateUniqueFilename(filename);
                await s3
                    .upload({
                    Bucket: bucketName || "",
                    Key: uniqueFilename,
                    Body: fileStream,
                })
                    .promise();
                console.log(`${filename} uploaded to S3 as ${uniqueFilename}`);
            });
            await Promise.all(uploadPromises);
            res.send("Transcoding complete!");
        }
        catch (err) {
            console.error("Error uploading files to S3:", err);
            res.status(500).send("Error uploading files to S3.");
        }
    });
});
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
