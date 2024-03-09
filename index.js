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
                    trip {
                        routeShortName
                        id
                        stoptimes {
                            scheduledArrival
                            realtimeArrival
                            realtime
                            stopSequence
                            stop {
                                name
                                gtfsId
                            }
                        }
                    }
                }
            }
        }
    `;

    const intToTime = (timestamp, toString = true) => {
        let hours = String(parseInt(timestamp / 3600));
        let minutes = String(parseInt((timestamp % 3600) / 60));
        return toString ? `${hours.padStart(2, '0')}:${minutes.padStart(2, '0')}` : { hours, minutes };
    };

    const minutesToDeparture = (currentDate, departureTime) => {
        const departureMinutes = parseInt(departureTime / 60);
        const currentMinutes = currentDate.getHours() * 60 + currentDate.getMinutes();
        return departureMinutes - currentMinutes;
    };

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

        const htmlContent = await fs.readFile(path.join(__dirname, 'public', 'dashboard.html'), 'utf8');
        const $ = require('cheerio').load(htmlContent);
        const timetableContainer = $('#timetable-container');

        timetableContainer.empty();

        if (responseData.data && responseData.data.stop) {
            const { name, stoptimesWithoutPatterns } = responseData.data.stop;
            timetableContainer.append(`<h2>Timetables for ${name}</h2>`);

            stoptimesWithoutPatterns.forEach(stopTime => {
                const { scheduledDeparture, realtimeDeparture, realtime, trip } = stopTime;
                const departureTime = realtime ? realtimeDeparture : scheduledDeparture;

                const departureInfo = `<p>Departure Time: ${intToTime(departureTime)} (in ${minutesToDeparture(new Date(), departureTime)} minutes)</p>`;
                timetableContainer.append(departureInfo);

                trip.stoptimes.forEach((st, index) => {
                    if ([9, 14].includes(index)) {
                        const arrivalInfo = `<p>Arrival in ${st.stop.name}: ${intToTime(st.scheduledArrival)}</p>`;
                        timetableContainer.append(arrivalInfo);
                    }
                });

                timetableContainer.append('<hr>');
            });
        } else {
            timetableContainer.append('<p>No data found.</p>');
        }

        // add daily quote
        const {quote, author} = await fetchDailyQuote();
        const quoteContainer = $('#quote-container');
        quoteContainer.empty();
        quoteContainer.append(`<p>"${quote}"</p>`);
        quoteContainer.append(`<p>- ${author}</p>`);

        return $.html(); // Return the modified HTML
    } catch (error) {
        console.error('Error fetching data:', error);
        return '<p>Error fetching timetables. Please try again later or contact support.</p>';
    }
}


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