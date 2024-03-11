const express = require('express');
const app = express();
const port = 3000;
const path = require('path');
const fs = require('fs').promises; // Node.js File System module with Promises
require('dotenv').config();

// Serving static files from 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Root endpoint
app.get('/', (req, res) => {
    res.send('Hello World!');
});

// Timetables endpoint
app.get('/timetables', async (req, res) => {
    const result = await fetchSubwayTimetables();
    res.send(result);
});

// Start the server
app.listen(port, () => {
  console.log(`App listening on port ${port}`);
});

// Function to fetch subway timetables for Matinkylä station
async function fetchSubwayTimetables() {
    const apiUrl = 'https://api.digitransit.fi/routing/v1/routers/hsl/index/graphql';
    const subscriptionKey = process.env.HSL_ACCESS_KEY;

    const query = `
        {
            stop(id: "HSL:2314601") {
                name
                stoptimesWithoutPatterns {
                    scheduledDeparture
                    realtimeDeparture
                    realtime
                }
            }
        }
    `;

    try {
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'digitransit-subscription-key': subscriptionKey
            },
            body: JSON.stringify({ query })
        });

        const responseData = await response.json();
        console.log(responseData)

        const htmlContent = await fs.readFile(path.join(__dirname, 'public', 'dashboard.html'), 'utf8');
        const $ = require('cheerio').load(htmlContent);

        // Make timetable container
        const timetableContainer = $('#timetable-container');
        timetableContainer.empty();
        timetableContainer.css('text-align', 'center');

        // Display timetables
        if (responseData.data && responseData.data.stop) {
            const { name, stoptimesWithoutPatterns } = responseData.data.stop;

            stoptimesWithoutPatterns.forEach((d) => {
                const departureTime = d.realtime ? d.realtimeDeparture : d.scheduledDeparture;
                const timeToDeparture = minutesToDeparture(departureTime);

                let urgency;
                if (timeToDeparture < 4) urgency = "grey";
                else if (timeToDeparture < 6) urgency = "red";
                else if (timeToDeparture < 9) urgency = "yellow";
                else urgency = "green";

                const imageWidth = 140
                const height = 38
                let flameSideLength = Math.round(height * 1.5)

                // Build the SVG content as a string
                const visualisation = `
                                            <div class="image-container" style="position: relative; width: ${imageWidth}px; height: ${height*3}px; display: inline-block; margin-right: 10px; margin-top: 10px;">
                                                <img src="images/subways/subway-${urgency}.svg" alt="subway-${urgency}" style="width: ${imageWidth}px; height: ${height}px; position: absolute; top: ${flameSideLength}px; left: 0;">
                                                <img src="images/flames/flame-${urgency}.svg" alt="flame-${urgency}" style="height: ${flameSideLength}px; position: absolute; left: 50%;  transform: translate(-50%, 0);">
                                                <span style="position: absolute; left: 50%; transform: translate(-50%, 110%); font-family: 'Orbitron', sans-serif; color: black; font-size: 18px; font-weight: 900">${timeToDeparture}</span>
                                                <span style="position: absolute; left: 50%; transform: translate(-50%,375%); font-family: 'Orbitron', sans-serif; color: dimgrey; font-size: 20px">${intToTime(departureTime)}</span>
                                            </div>
                                            `;

                timetableContainer.append(visualisation)

            });
        } else {
            timetableContainer.append('<p>No data found.</p>');
        }

        // add daily quote
        const {quote, author} = await fetchDailyQuote();
        const quoteContainer = $('#quote-container');
        quoteContainer.empty();
        quoteContainer.css('text-align', 'center');
        quoteContainer.append(`<p>"${quote}"</p>`);
        quoteContainer.append(`<p style="font-style: normal">- ${author}</p>`);

        return $.html(); // Return the modified HTML
    } catch (error) {
        console.error('Error fetching data:', error);
        return '<p>Error fetching timetables. Please try again later or contact support.</p>';
    }
}

const intToTime = (timestamp, toString = true) => {
    let hours = String(parseInt(timestamp / 3600));
    let minutes = String(parseInt((timestamp % 3600) / 60));
    return toString ? `${hours.padStart(2, '0')}:${minutes.padStart(2, '0')}` : { hours, minutes };
};

const minutesToDeparture = (departureTime) => {
    const now = new Date();
    const currentTime = now.toLocaleTimeString('fi-FI', {timeZone: 'Europe/Helsinki'}).split('.')
    const departureMinutes = parseInt(departureTime / 60);
    const currentMinutes = parseInt(currentTime[0]) * 60 + parseInt(currentTime[1]);
    return departureMinutes - currentMinutes;
};

const fetchDailyQuote = async () => {
    const apiUrl = 'https://zenquotes.io/api/today';
    try {
        const response = await fetch(apiUrl);
        const responseData = await response.json();

        return {
            "quote": responseData[0].q, 
            "author": responseData[0].a
        };

    } catch (error) {
        console.error('Error fetching quote data:', error);
        return {
            "quote": "Error fetching quote", 
            "author": "Jape Niskala"
        };
    }
}