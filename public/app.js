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
    // ... (keep your existing getMedia function)
}

// ... (keep your existing UI event listeners and functions)

function makeWebRTCConnection(userId) {
    const peer = new RTCPeerConnection({
        iceServers: [
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun3.l.google.com:19302' },
            { urls: 'stun:stun4.l.google.com:19302' }
        ]
    });

    mediaStream.getTracks().forEach(track => {
        peer.addTrack(track, mediaStream);
    });

    peer.onicecandidate = (event) => {
        if (event.candidate) {
            socket.emit("sendIceCandidate", {
                to: userId,
                candidate: event.candidate
            });
        }
    };

    peer.ontrack = (event) => {
        const video = document.createElement('video');
        video.srcObject = event.streams[0];
        video.id = `video-${userId}`;
        video.addEventListener('loadedmetadata', () => {
            video.play();
        });
        videoGrid.appendChild(video);
    };

    return peer;
}

socket.on('connect', () => {
    socket.emit('joinRoom', roomId);
});

socket.on('userJoined', (userId) => {
    const peer = makeWebRTCConnection(userId);
    peers[userId] = peer;
    makeOffer(userId, peer);
});

socket.on('userLeft', (userId) => {
    if (peers[userId]) {
        peers[userId].close();
        delete peers[userId];
    }
    const video = document.getElementById(`video-${userId}`);
    if (video) video.remove();
});

socket.on("receiveOffer", async ({ from, offer }) => {
    let peer = peers[from];
    if (!peer) {
        peer = makeWebRTCConnection(from);
        peers[from] = peer;
    }
    await peer.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await peer.createAnswer();
    await peer.setLocalDescription(answer);
    socket.emit("sendAnswer", { to: from, answer });
});

socket.on("receiveAnswer", async ({ from, answer }) => {
    const peer = peers[from];
    if (peer) {
        await peer.setRemoteDescription(new RTCSessionDescription(answer));
    }
});

socket.on("receiveIceCandidate", ({ from, candidate }) => {
    const peer = peers[from];
    if (peer) {
        peer.addIceCandidate(new RTCIceCandidate(candidate));
    }
});

async function makeOffer(userId, peer) {
    const offer = await peer.createOffer();
    await peer.setLocalDescription(offer);
    socket.emit("sendOffer", { to: userId, offer });
}

getMedia(); 