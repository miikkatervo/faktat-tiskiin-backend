const express = require('express')
const app = express()
const port = 3000
const path = require('path');

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.send('hello world')
})

app.get('/timetables', (req, res) => {
    const result = fetchSubwayTimetables();
    res.send(result);
})

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})

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

    function intToTime(timestamp, toString = true) {
        hours = String(parseInt(timestamp/60/60))
        minutes = String(parseInt((timestamp/60/60 - hours)*60))

        if(toString) return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
        else return {'hours': hours,'minutes': minutes}
    }

    function minutesToDeparture(currentDate, departureTime) {
        const departureMinutes = parseInt(departureTime/60)
        const currentMinutes = currentDate.getHours()*60 + currentDate.getMinutes()
        return departureMinutes - currentMinutes
    }

    try {
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'digitransit-subscription-key': subscriptionKey // Include the subscription key
            },
            body: JSON.stringify({ query })
        });

        const responseData = await response.json();

        const timetableContainer = document.getElementById('timetable-container');
        timetableContainer.innerHTML = ''; // Clear previous content

        const currentDate = new Date();

        if (responseData.data && responseData.data.stop) {
            const { name, stoptimesWithoutPatterns } = responseData.data.stop;

            const title = document.createElement('h2');
            title.textContent = `Timetables for ${name}`;
            timetableContainer.appendChild(title);

            stoptimesWithoutPatterns.forEach(stopTime => {
                const { scheduledDeparture, realtimeDeparture, realtime, trip } = stopTime;

                const departureTime = realtime ? realtimeDeparture : scheduledDeparture;

                const inOtaniemi = trip.stoptimes[9]
                const otaTime = inOtaniemi.scheduledArrival

                const inKamppi = trip.stoptimes[14]
                const champTime = inKamppi.scheduledArrival

                const departureInfo = document.createElement('p');
                departureInfo.textContent = `Departure Time: ${intToTime(departureTime)} (in ${minutesToDeparture(currentDate, departureTime)} minutes)`;
                timetableContainer.appendChild(departureInfo);

                const otaniemiArrivalInfo = document.createElement('p');
                otaniemiArrivalInfo.textContent = `Arrival in Otaniemi: ${intToTime(otaTime)}`;
                timetableContainer.appendChild(otaniemiArrivalInfo);

                const kamppiArrivalInfo = document.createElement('p');
                kamppiArrivalInfo.textContent = `Arrival in Kamppi: ${intToTime(champTime)}`;
                timetableContainer.appendChild(kamppiArrivalInfo);

                const spacer = document.createElement('hr');
                timetableContainer.appendChild(spacer);
            });
        } else {
            const noDataMessage = document.createElement('p');
            noDataMessage.textContent = 'No data found.';
            timetableContainer.appendChild(noDataMessage);
        }
    } catch (error) {
        console.error('Error fetching data:', error);
    }
}