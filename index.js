const midi = require('midi');
const rtpmidi = require('rtpmidi');
const express = require('express');

// Device name to search for
const deviceName = 'CH345';

// Set up the Express server
const app = express();
const port = 5003;

// Set up the RTPMidi session
const session = rtpmidi.manager.createSession({
    localName: 'Network To USB MIDI',
    bonjourName: 'Network To USB MIDI',
    port: 5004,
    
});

let output;
let devicePort = -1;

// Function to find and open the USB MIDI device port
function openMidiPort() {
    output = new midi.Output();
    const portCount = output.getPortCount();

    for (let i = 0; i < portCount; i++) {
        const name = output.getPortName(i);
        console.log(`${i}: ${name}`);
        if (name.includes(deviceName)) {
            devicePort = i;
            break;
        }
    }

    if (devicePort === -1) {
        console.error(`Device "${deviceName}" not found.`);
        return false;
    }

    output.openPort(devicePort); // Open the correct port number for your USB MIDI device
    return true;
}

// Initial attempt to open the MIDI port
if (!openMidiPort()) {
    console.error('Failed to open MIDI port. Please connect the device and restart the script.');
    process.exit(1);
}

// Handle incoming RTPMidi messages and forward them to the USB MIDI device
session.on('message', (deltaTime, message) => {
    if (Buffer.isBuffer(message)) {
        // Convert Buffer to an array and send it as a MIDI message
        output.sendMessage(Array.from(message));
    } else if (Array.isArray(message)) {
        output.sendMessage(message);
    } else {
        console.error('Received message is not in an expected format:', message);
    }
});

session.on('ready', () => {
    console.log('RTPMidi session is ready to receive messages.');
});

console.log('MIDI server is running.');

// Set up the HTTP server to handle reconnection requests
app.get('/reconnect', (req, res) => {
    console.log('Reconnection request received.');

    if (devicePort !== -1) {
        output.closePort();
        devicePort = -1;
    }

    if (openMidiPort()) {
        res.send('MIDI port reconnected successfully.');
    } else {
        res.status(500).send('Failed to reconnect MIDI port. Please check the device connection.');
    }
});
// Set up the HTTP server to provide status
app.get('/status', (req, res) => {
    if (devicePort !== -1) {
        res.json({
            status: 'connected',
            port: devicePort,
            deviceName: output.getPortName(devicePort)
        });
    } else {
        res.json({
            status: 'disconnected'
        });
    }
});

// Start the HTTP server
app.listen(port, () => {
    console.log(`HTTP server listening at http://localhost:${port}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
    if (devicePort !== -1) {
        output.closePort();
    }
    rtpmidi.manager.close();
    process.exit();
});
