// Constants
const videoGrid = document.getElementById("video_grid");
const muteBtn = document.getElementById("muteBtn");
const cameraoff = document.getElementById("cameraoff");
const selectCam = document.getElementById("selectCam");
const selectMic = document.getElementById("selectMic");
const screenShare = document.getElementById("screenShare");
const meetingHeading = document.getElementById("meetingHeading");

// Socket initialization
const socket = io();

// Global variables
let mediaStream;
let screenStream;
let mute = false;
let camera = true;
let currentCam;
let peers = {};

// Set meeting heading
meetingHeading.textContent = `Meeting: ${roomId}`;

// Mute button handler
muteBtn.addEventListener("click", toggleMute);

// Camera toggle handler
cameraoff.addEventListener('click', toggleCamera);

// Screen share handler
screenShare.addEventListener('click', toggleScreenShare);

// Initialize media and WebRTC connection
getMedia();

// Camera selection handler
selectCam.addEventListener('input', (e) => {
    const cameraId = e.target.value;
    getMedia(cameraId);
});

// Microphone selection handler
selectMic.addEventListener('input', (e) => {
    const micId = e.target.value;
    getMedia(null, micId);
});

// Main functions
async function getMedia(cameraId, micId) {
    try {
        const constraints = getMediaConstraints(cameraId, micId);
        mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
        
        displayMedia(mediaStream, true);
        await updateDeviceLists();
        
        // Close existing peer connections and create new ones
        Object.values(peers).forEach(peer => peer.close());
        peers = {};
        
        joinRoom();
    } catch (error) {
        console.error("Error accessing media devices:", error);
    }
}

function getMediaConstraints(cameraId, micId) {
    const videoConstraints = cameraId ? { deviceId: { exact: cameraId } } : true;
    const audioConstraints = micId ? { deviceId: { exact: micId } } : true;
    
    return {
        video: videoConstraints,
        audio: audioConstraints
    };
}

function displayMedia(stream, isLocal = false) {
    const video = document.createElement('video');
    video.srcObject = stream;
    video.addEventListener('loadedmetadata', () => video.play());
    video.muted = isLocal; // Mute local video to prevent echo
    videoGrid.appendChild(video);
    return video;
}

async function updateDeviceLists() {
    const devices = await navigator.mediaDevices.enumerateDevices();
    updateDeviceList(selectCam, "videoinput", mediaStream.getVideoTracks()[0]);
    updateDeviceList(selectMic, "audioinput", mediaStream.getAudioTracks()[0]);
}

function updateDeviceList(selectElement, deviceKind, currentTrack) {
    selectElement.innerHTML = '';
    devices
        .filter(device => device.kind === deviceKind)
        .forEach(device => {
            const option = document.createElement('option');
            option.value = device.deviceId;
            option.textContent = device.label;
            option.selected = device.label === currentTrack.label;
            selectElement.appendChild(option);
        });
}

function joinRoom() {
    socket.emit('joinRoom', roomId);
}

function createPeerConnection(peerId) {
    const peerConnection = new RTCPeerConnection({
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' },
        ]
    });

    mediaStream.getTracks().forEach(track => peerConnection.addTrack(track, mediaStream));

    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            socket.emit("sendIceCandidate", { peerId, candidate: event.candidate }, roomId);
        }
    };

    peerConnection.ontrack = (event) => {
        const remoteVideo = displayMedia(event.streams[0]);
        remoteVideo.setAttribute('data-peer-id', peerId);
    };

    return peerConnection;
}

// Socket event handlers
socket.on("newJoining", (peerId) => {
    const peerConnection = createPeerConnection(peerId);
    peers[peerId] = peerConnection;
    makeOffer(peerConnection, peerId);
});

socket.on("receiveOffer", async ({ peerId, offer }) => {
    const peerConnection = createPeerConnection(peerId);
    peers[peerId] = peerConnection;
    await peerConnection.setRemoteDescription(offer);
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    socket.emit("sendAnswer", { peerId, answer }, roomId);
});

socket.on("receiveAnswer", async ({ peerId, answer }) => {
    await peers[peerId].setRemoteDescription(answer);
});

socket.on("receiveIceCandidate", ({ peerId, candidate }) => {
    peers[peerId].addIceCandidate(new RTCIceCandidate(candidate));
});

socket.on("peerDisconnected", (peerId) => {
    if (peers[peerId]) {
        peers[peerId].close();
        delete peers[peerId];
    }
    const remoteVideo = document.querySelector(`video[data-peer-id="${peerId}"]`);
    if (remoteVideo) remoteVideo.remove();
});

// Helper functions
async function makeOffer(peerConnection, peerId) {
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    socket.emit("sendOffer", { peerId, offer }, roomId);
}

function toggleMute() {
    mute = !mute;
    mediaStream.getAudioTracks().forEach(track => track.enabled = !mute);
    muteBtn.textContent = mute ? "Unmute yourself" : "Mute yourself";
}

function toggleCamera() {
    camera = !camera;
    mediaStream.getVideoTracks().forEach(track => track.enabled = camera);
    cameraoff.textContent = camera ? "Turn off camera" : "Turn on camera";
}

async function toggleScreenShare() {
    if (!screenStream) {
        try {
            screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
            const videoTrack = screenStream.getVideoTracks()[0];
            
            Object.values(peers).forEach(peer => {
                const sender = peer.getSenders().find(s => s.track.kind === 'video');
                sender.replaceTrack(videoTrack);
            });
            
            videoTrack.onended = stopScreenShare;
            screenShare.textContent = "Stop sharing";
        } catch (error) {
            console.error("Error sharing screen:", error);
        }
    } else {
        stopScreenShare();
    }
}

function stopScreenShare() {
    if (screenStream) {
        screenStream.getTracks().forEach(track => track.stop());
        screenStream = null;
        
        const videoTrack = mediaStream.getVideoTracks()[0];
        Object.values(peers).forEach(peer => {
            const sender = peer.getSenders().find(s => s.track.kind === 'video');
            sender.replaceTrack(videoTrack);
        });
        
        screenShare.textContent = "Share your Screen";
    }
}