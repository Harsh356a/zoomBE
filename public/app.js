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

        videoGrid.appendChild(localVideo);
        console.log("Local video appended to video grid");

        // Setup UI controls
        setupUIControls();

        // Setup WebRTC
        setupWebRTC();

        return true;
    } catch (error) {
        console.error("Error accessing media devices:", error);
        return false;
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

    socket.on('receiveOffer', async ({ from, offer }) => {
        console.log('Received offer from:', from);
        let peer = peers[from];
        if (!peer) {
            peer = createPeerConnection(from);
            peers[from] = peer;
        }
        try {
            await peer.setRemoteDescription(new RTCSessionDescription(offer));
            const answer = await peer.createAnswer();
            await peer.setLocalDescription(answer);
            socket.emit('sendAnswer', { to: from, answer });
        } catch (error) {
            console.error('Error handling offer:', error);
        }
    });

    socket.on('receiveAnswer', async ({ from, answer }) => {
        console.log('Received answer from:', from);
        const peer = peers[from];
        if (peer) {
            try {
                await peer.setRemoteDescription(new RTCSessionDescription(answer));
            } catch (error) {
                console.error('Error setting remote description:', error);
            }
        }
    });

    socket.on('receiveIceCandidate', async ({ from, candidate }) => {
        console.log('Received ICE candidate from:', from);
        const peer = peers[from];
        if (peer) {
            try {
                await peer.addIceCandidate(new RTCIceCandidate(candidate));
            } catch (error) {
                console.error('Error adding ICE candidate:', error);
            }
        }
    });
}

function createPeerConnection(userId) {
    const peer = new RTCPeerConnection({
        iceServers: [
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun3.l.google.com:19302' },
            { urls: 'stun:stun4.l.google.com:19302' }
        ]
    });

    peer.onicecandidate = (event) => {
        if (event.candidate) {
            socket.emit('sendIceCandidate', {
                to: userId,
                candidate: event.candidate
            });
        }
    };

    peer.ontrack = (event) => {
        console.log('Received remote track', event);
        const video = document.createElement('video');
        video.srcObject = event.streams[0];
        video.id = `video-${userId}`;
        video.addEventListener('loadedmetadata', () => {
            video.play().catch(error => console.error("Error playing remote video:", error));
        });
        videoGrid.appendChild(video);
    };

    peer.oniceconnectionstatechange = () => {
        console.log(`ICE connection state change: ${peer.iceConnectionState}`);
    };

    peer.onsignalingstatechange = () => {
        console.log(`Signaling state change: ${peer.signalingState}`);
    };

    mediaStream.getTracks().forEach(track => {
        peer.addTrack(track, mediaStream);
    });

    return peer;
}

async function makeOffer(userId, peer) {
    try {
        const offer = await peer.createOffer();
        await peer.setLocalDescription(offer);
        socket.emit('sendOffer', { to: userId, offer });
    } catch (error) {
        console.error('Error creating offer:', error);
    }
}

// Start the application
getMedia().then(success => {
    if (!success) {
        console.error("Failed to get media. Check console for more details.");
    }
}).catch(error => {
    console.error("An error occurred while getting media:", error);
});