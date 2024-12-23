require("dotenv").config();
const { google } = require("googleapis");
const axios = require("axios");
const { Parser } = require("json2csv");
const fs = require("fs");
const readlineSync = require("readline-sync");

const API_KEY = process.env.YOUTUBE_API_KEY; // Load API key from .env
const youtube = google.youtube({
  version: "v3",
  auth: API_KEY,
});

// Function to fetch videos based on genre
async function fetchVideosForGenre(genre, maxResults = 500) {
  let videos = [];
  let nextPageToken = null;

  while (videos.length < maxResults) {
    const response = await youtube.search.list({
      part: "snippet",
      q: genre,
      type: "video",
      maxResults: Math.min(50, maxResults - videos.length),
      pageToken: nextPageToken,
    });

    videos = videos.concat(response.data.items);
    nextPageToken = response.data.nextPageToken;

    if (!nextPageToken) break; // Stop if no more pages
  }

  return videos;
}

// Function to fetch detailed metadata for videos
async function fetchVideoDetails(videoIds) {
  const response = await youtube.videos.list({
    part: "snippet,contentDetails,statistics,topicDetails",
    id: videoIds.join(","),
  });
  return response.data.items;
}

// Function to fetch captions
async function fetchCaptions(videoId) {
  try {
    const response = await axios.get(
      `https://www.youtube.com/api/timedtext?lang=en&v=${videoId}`
    );
    return response.data || null;
  } catch (error) {
    return null;
  }
}

// Main function
async function main() {
  // Step 1: Take genre input from the user
  const genre = readlineSync.question("Enter the genre: ");
  console.log(`Fetching videos for genre: ${genre}`);

  // Step 2: Fetch top videos for the genre
  const videos = await fetchVideosForGenre(genre);
  console.log(`Found ${videos.length} videos`);

  const videoDetails = [];
  const csvFields = [
    "Video URL",
    "Title",
    "Description",
    "Channel Title",
    "Keyword Tags",
    "YouTube Video Category",
    "Topic Details",
    "Video Published at",
    "Video Duration",
    "View Count",
    "Comment Count",
    "Captions Available",
    "Caption Text",
    "Location of Recording",
  ];

  for (const video of videos) {
    const videoId = video.id.videoId;
    const details = await fetchVideoDetails([videoId]);
    if (details.length > 0) {
      const videoDetail = details[0];
      const captions = await fetchCaptions(videoId);

      videoDetails.push({
        "Video URL": `https://www.youtube.com/watch?v=${videoId}`,
        Title: videoDetail.snippet.title,
        Description: videoDetail.snippet.description,
        "Channel Title": videoDetail.snippet.channelTitle,
        "Keyword Tags": videoDetail.snippet.tags?.join(", ") || "N/A",
        "YouTube Video Category": videoDetail.snippet.categoryId,
        "Topic Details": videoDetail.topicDetails?.topicCategories?.join(", ") || "N/A",
        "Video Published at": videoDetail.snippet.publishedAt,
        "Video Duration": videoDetail.contentDetails.duration,
        "View Count": videoDetail.statistics.viewCount,
        "Comment Count": videoDetail.statistics.commentCount || 0,
        "Captions Available": captions ? true : false,
        "Caption Text": captions || "N/A",
        "Location of Recording": videoDetail.recordingDetails?.locationDescription || "N/A",
      });
    }
  }

  // Step 3: Write the data into a CSV file
  const parser = new Parser({ fields: csvFields });
  const csv = parser.parse(videoDetails);

  fs.writeFileSync(`videos_${genre}.csv`, csv);
  console.log(`Data saved to videos_${genre}.csv`);
}

main();
