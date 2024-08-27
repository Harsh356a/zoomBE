const videoGrid = document.getElementById("video-grid");
const muteBtn = document.getElementById("muteBtn");
const cameraoff = document.getElementById("cameraoff");
const selectCam = document.getElementById("selectCam");
const selectMic = document.getElementById("selectMic");
const screenShare = document.getElementById("screenShare");

const socket = io();
let mediaStream;
let mute = false;
let camera = true;
let currentCam;
let peers = {};

async function getMedia(cameraId, micId) {
    try {
        const constraints = {
            audio: micId ? { deviceId: { exact: micId } } : true,
            video: cameraId ? { deviceId: { exact: cameraId } } : true
        };

        console.log("Attempting to get user media with constraints:", constraints);

        mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
        
        console.log("Media stream obtained:", mediaStream);
        
        // Display local video
        const localVideo = document.createElement('video');
        localVideo.muted = true;
        localVideo.srcObject = mediaStream;
        localVideo.style.width = "300px";
        localVideo.style.height = "225px";
        localVideo.style.border = "1px solid red";

        console.log("Local video element created:", localVideo);

        localVideo.addEventListener('loadedmetadata', () => {
            console.log("Video metadata loaded, attempting to play");
            localVideo.play().then(() => {
                console.log("Video playback started");
            }).catch(error => {
                console.error("Error starting video playback:", error);
            });
        });

        if (!videoGrid) {
            console.error("Video grid element not found!");
            return false;
        }

        videoGrid.appendChild(localVideo);
        console.log("Local video appended to video grid");

        // Create test video
        const testVideo = document.createElement('video');
        testVideo.muted = true;
        testVideo.srcObject = mediaStream;
        testVideo.style.width = "300px";
        testVideo.style.height = "225px";
        document.body.appendChild(testVideo);
        testVideo.play().catch(error => console.error("Error playing test video:", error));

        // Setup UI controls
        setupUIControls();

        // Setup WebRTC
        setupWebRTC();

        // Check video tracks
        checkVideoTracks();

        return true;
    } catch (error) {
        console.error("Error accessing media devices:", error);
        return false;
    }
}

function checkVideoTracks() {
    if (mediaStream) {
        const videoTracks = mediaStream.getVideoTracks();
        console.log("Video tracks:", videoTracks);
        videoTracks.forEach((track, index) => {
            console.log(`Video track ${index} enabled:`, track.enabled);
        });
    } else {
        console.log("No media stream available");
    }
}

function setupUIControls() {
    muteBtn.addEventListener("click", toggleMute);
    cameraoff.addEventListener("click", toggleCamera);
    // Add event listeners for selectCam and selectMic if needed
}

function toggleMute() {
    mediaStream.getAudioTracks().forEach(track => {
        track.enabled = mute;
    });
    mute = !mute;
    muteBtn.textContent = mute ? "Unmute" : "Mute";
}

function toggleCamera() {
    mediaStream.getVideoTracks().forEach(track => {
        track.enabled = !camera;
    });
    camera = !camera;
    cameraoff.textContent = camera ? "Turn off camera" : "Turn on camera";
}

function setupWebRTC() {
    socket.emit('joinRoom', roomId);

    socket.on('userJoined', (userId) => {
        console.log('New user joined:', userId);
        if (!peers[userId]) {
            const peer = createPeerConnection(userId);
            peers[userId] = peer;
            makeOffer(userId, peer);
        }
    });

    socket.on('allUsers', (users) => {
        console.log('Existing users in the room:', users);
        users.forEach(userId => {
            if (!peers[userId]) {
                const peer = createPeerConnection(userId);
                peers[userId] = peer;
                makeOffer(userId, peer);
            }
        });
    });

    socket.on('userLeft', (userId) => {
        console.log('User left:', userId);
        if (peers[userId]) {
            peers[userId].close();
            delete peers[userId];
        }
        const videoElement = document.getElementById(`video-${userId}`);
        if (videoElement) {
            videoElement.remove();
        }
    });

    socket.on('receiveOffer', async ({ from, offer }) => {
        console.log('Received offer from:', from);
        let peer = peers[from];
        if (!peer) {
            peer = createPeerConnection(from);
            peers[from] = peer;
        }
        await peer.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await peer.createAnswer();
        await peer.setLocalDescription(answer);
        socket.emit('sendAnswer', { to: from, answer });
    });

    socket.on('receiveAnswer', async ({ from, answer }) => {
        console.log('Received answer from:', from);
        const peer = peers[from];
        if (peer) {
            await peer.setRemoteDescription(new RTCSessionDescription(answer));
        }
    });

    socket.on('receiveIceCandidate', ({ from, candidate }) => {
        console.log('Received ICE candidate from:', from);
        const peer = peers[from];
        if (peer) {
            peer.addIceCandidate(new RTCIceCandidate(candidate));
        }
    });
}

function createPeerConnection(userId) {
    // ... (your existing createPeerConnection function)
}

// ... (rest of the WebRTC functions like makeOffer, etc.)

// Start the application
getMedia().then(success => {
    if (!success) {
        console.error("Failed to get media. Check console for more details.");
    }
}).catch(error => {
    console.error("An error occurred while getting media:", error);
});