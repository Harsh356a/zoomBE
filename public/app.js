const videoGrid = document.getElementById("video-grid");
const muteBtn = document.getElementById("muteBtn");
const cameraoff = document.getElementById("cameraoff");
const selectCam = document.getElementById("selectCam");
const selectMic = document.getElementById("selectMic");
const screenShare = document.getElementById("screenShare");
const meetingHeading = document.getElementById("meetingHeading");

const socket = io();

let mediaStream;
let screenStream;
let mute = false;
let camera = true;
let currentCam;
let peers = {};

meetingHeading.textContent = `Meeting: ${roomId}`;

muteBtn.addEventListener("click", toggleMute);
cameraoff.addEventListener('click', toggleCamera);
screenShare.addEventListener('click', toggleScreenShare);
selectCam.addEventListener('input', (e) => getMedia(e.target.value));
selectMic.addEventListener('input', (e) => getMedia(null, e.target.value));

async function getMedia(cameraId, micId) {
    const constraints = {
        video: cameraId ? { deviceId: { exact: cameraId } } : true,
        audio: micId ? { deviceId: { exact: micId } } : true
    };

    try {
        if (mediaStream) {
            mediaStream.getTracks().forEach(track => track.stop());
        }
        mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
        
        const myVideo = document.createElement('video');
        addVideoStream(myVideo, mediaStream);
        
        if (Object.keys(peers).length > 0) {
            Object.values(peers).forEach(peer => {
                const sender = peer.getSenders().find(s => s.track.kind === 'video');
                if (sender) {
                    sender.replaceTrack(mediaStream.getVideoTracks()[0]);
                }
            });
        } else {
            socket.emit('join-room', ROOM_ID, 10);
        }

        await updateDeviceLists();
    } catch (error) {
        console.error("Error accessing media devices:", error);
    }
}

async function updateDeviceLists() {
    const devices = await navigator.mediaDevices.enumerateDevices();
    updateDeviceList(selectCam, "videoinput", mediaStream.getVideoTracks()[0]);
    updateDeviceList(selectMic, "audioinput", mediaStream.getAudioTracks()[0]);
}

function updateDeviceList(selectElement, deviceKind, currentTrack) {
    selectElement.innerHTML = '';
    const devices = await navigator.mediaDevices.enumerateDevices();
    devices
        .filter(device => device.kind === deviceKind)
        .forEach(device => {
            const option = document.createElement('option');
            option.value = device.deviceId;
            option.text = device.label || `${deviceKind} ${selectElement.length + 1}`;
            option.selected = device.label === currentTrack.label;
            selectElement.appendChild(option);
        });
}

function addVideoStream(video, stream) {
    video.srcObject = stream;
    video.addEventListener('loadedmetadata', () => video.play());
    videoGrid.appendChild(video);
}

function toggleMute() {
    mute = !mute;
    mediaStream.getAudioTracks().forEach(track => track.enabled = !mute);
    muteBtn.textContent = mute ? "Unmute" : "Mute";
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
                if (sender) {
                    sender.replaceTrack(videoTrack);
                }
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
            if (sender) {
                sender.replaceTrack(videoTrack);
            }
        });
        
        screenShare.textContent = "Share Screen";
    }
}

function connectToNewUser(userId, stream) {
    const call = myPeer.call(userId, stream);
    const video = document.createElement('video');
    call.on('stream', userVideoStream => {
        addVideoStream(video, userVideoStream);
    });
    call.on('close', () => {
        video.remove();
    });

    peers[userId] = call;
}

getMedia();

socket.on('user-connected', userId => {
    connectToNewUser(userId, mediaStream);
});

socket.on('user-disconnected', userId => {
    if (peers[userId]) peers[userId].close();
});

myPeer.on('open', id => {
    socket.emit('join-room', ROOM_ID, id);
});

myPeer.on('call', call => {
    call.answer(mediaStream);
    const video = document.createElement('video');
    call.on('stream', userVideoStream => {
        addVideoStream(video, userVideoStream);
    });
});