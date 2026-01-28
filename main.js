import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';

// --- Global Variables ---
let scene, camera, renderer, controls;
let sphereMesh = null;
const fileInput = document.getElementById('file-input');
const loadingOverlay = document.getElementById('loading-overlay');
const toggleMenuBtn = document.getElementById('toggle-menu');
const menuDropdown = document.getElementById('menu-dropdown');
const sceneItemsContainer = document.getElementById('scene-items');
const scenesSection = document.getElementById('scenes-section'); // New container reference

// New UI Elements
const transitionOverlay = document.getElementById('transition-overlay');
const dropZone = document.getElementById('drop-zone');
const btnFullscreen = document.getElementById('btn-fullscreen');
const toggleAutorotate = document.getElementById('toggle-autorotate');
const sliderExposure = document.getElementById('slider-exposure');
const valExposure = document.getElementById('exposure-val');
const btnReset = document.getElementById('btn-reset');

let scenes = []; // Array of { name, url, file }
let currentSceneIndex = -1;
let isAutoRotating = false;
let defaultFov = 75; // Store default FOV for reset

init();
animate();

function init() {
    // Signal liveness to index.html
    window.appLoaded = true;
    console.log("App initialized");

    // Ensure canvas exists
    const canvas = document.querySelector('#canvas');

    // 1. Scene
    scene = new THREE.Scene();

    // 2. Camera
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 0, 0.1);

    // 3. Renderer
    renderer = new THREE.WebGLRenderer({
        canvas: canvas,
        antialias: true
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.toneMapping = THREE.ACESFilmicToneMapping; // Important for HDR
    renderer.toneMappingExposure = 1.0;

    // 4. Controls
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableZoom = false; // Disable OrbitControls zoom (dolly) to use custom FOV zoom
    controls.enablePan = false;
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.rotateSpeed = -0.5;
    controls.autoRotateSpeed = -1.0; // Slower and reversed direction

    // Custom Zoom (FOV) - Wheel
    canvas.addEventListener('wheel', (event) => {
        event.preventDefault();
        const fovMin = 30;
        const fovMax = 100;
        const sensitivity = 0.05;

        camera.fov += event.deltaY * sensitivity;
        camera.fov = Math.max(fovMin, Math.min(fovMax, camera.fov));
        camera.updateProjectionMatrix();
    }, { passive: false });

    // Custom Zoom (FOV) - Touch (Pinch)
    let initialPinchDistance = null;
    let initialFov = null;

    canvas.addEventListener('touchstart', (e) => {
        if (e.touches.length === 2) {
            const dx = e.touches[0].pageX - e.touches[1].pageX;
            const dy = e.touches[0].pageY - e.touches[1].pageY;
            initialPinchDistance = Math.sqrt(dx * dx + dy * dy);
            initialFov = camera.fov;
        }
    }, { passive: false });

    canvas.addEventListener('touchmove', (e) => {
        if (e.touches.length === 2 && initialPinchDistance !== null) {
            e.preventDefault(); // Prevent page scroll
            const dx = e.touches[0].pageX - e.touches[1].pageX;
            const dy = e.touches[0].pageY - e.touches[1].pageY;
            const currentDistance = Math.sqrt(dx * dx + dy * dy);

            // Calculate zoom factor
            // Distance increase -> Zoom IN (FOV decrease), so we subtract
            const diff = initialPinchDistance - currentDistance;
            const sensitivity = 0.2;

            let newFov = initialFov + diff * sensitivity;
            newFov = Math.max(30, Math.min(100, newFov));

            camera.fov = newFov;
            camera.updateProjectionMatrix();
        }
    }, { passive: false });

    canvas.addEventListener('touchend', () => {
        initialPinchDistance = null;
    });

    // 5. Initial Placeholder
    createSphere();

    // Event Listeners
    window.addEventListener('resize', onWindowResize);

    // Explicitly attach listener if element exists
    if (fileInput) {
        fileInput.addEventListener('change', (e) => {
            console.log("File input changed:", e.target.files);
            handleFileUpload(e);
        });
    }

    // Toggle Main Menu
    if (toggleMenuBtn && menuDropdown) {
        toggleMenuBtn.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent immediate close
            menuDropdown.classList.toggle('hidden');
        });

        // Close menu when clicking outside
        document.addEventListener('click', (e) => {
            if (!menuDropdown.classList.contains('hidden') &&
                !menuDropdown.contains(e.target) &&
                e.target !== toggleMenuBtn) {
                menuDropdown.classList.add('hidden');
            }
        });
    }

    // Rotation Controls & New Menu Listeners
    if (toggleAutorotate) {
        toggleAutorotate.addEventListener('change', (e) => {
            isAutoRotating = e.target.checked;
            controls.autoRotate = isAutoRotating;
        });
    }

    if (sliderExposure) {
        sliderExposure.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            renderer.toneMappingExposure = val;
            if (valExposure) valExposure.textContent = val.toFixed(1);
        });
    }

    if (btnReset) {
        btnReset.addEventListener('click', () => {
            resetView();
        });
    }

    if (btnFullscreen) {
        btnFullscreen.addEventListener('click', toggleFullscreen);
    }

    // Drag and Drop (Global)
    setupDragAndDrop();

    // Default exposure init
    if (sliderExposure) {
        renderer.toneMappingExposure = parseFloat(sliderExposure.value);
    }
}

function resetView() {
    // Reset Camera Position
    camera.position.set(0, 0, 0.1);
    camera.lookAt(0, 0, 0);

    // Reset FOV
    camera.fov = defaultFov;
    camera.updateProjectionMatrix();

    // Reset Controls
    controls.reset();
    controls.autoRotate = isAutoRotating; // Keep auto-rotate state

    // Reset Exposure
    renderer.toneMappingExposure = 1.0;
    if (sliderExposure) sliderExposure.value = "1.0";
    if (valExposure) valExposure.textContent = "1.0";
}

function toggleFullscreen() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen();
    } else {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        }
    }
}

function setupDragAndDrop() {
    // Prevent default behaviors
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        document.body.addEventListener(eventName, preventDefaults, false);
    });

    // Highlight drop zone
    ['dragenter', 'dragover'].forEach(eventName => {
        document.body.addEventListener(eventName, highlight, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        document.body.addEventListener(eventName, unhighlight, false);
    });

    // Handle dropped files
    document.body.addEventListener('drop', handleDrop, false);
}

function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
}

function highlight(e) {
    if (dropZone) {
        dropZone.classList.remove('hidden');
        // Small delay to ensure display:flex is applied before opacity transition if we wanted one
        // but for now simple display toggling
    }
}

function unhighlight(e) {
    if (dropZone) dropZone.classList.add('hidden');
}

function handleDrop(e) {
    const dt = e.dataTransfer;
    const files = dt.files;

    // Create a mock event object to reuse existing handler
    handleFileUpload({ target: { files: files } });
}



function createSphere(texture = null) {
    if (sphereMesh) {
        scene.remove(sphereMesh);
        sphereMesh.geometry.dispose();
        if (sphereMesh.material.map) sphereMesh.material.map.dispose();
        sphereMesh.material.dispose();
    }

    const geometry = new THREE.SphereGeometry(500, 60, 40);
    geometry.scale(-1, 1, 1);

    const material = new THREE.MeshBasicMaterial({
        map: texture,
        color: texture ? 0xffffff : 0x333333,
        side: THREE.FrontSide // Scale -1 already flips faces inward, so we view the Front
    });

    sphereMesh = new THREE.Mesh(geometry, material);
    scene.add(sphereMesh);
}

function showLoading(show) {
    if (!loadingOverlay) return;
    if (show) loadingOverlay.classList.remove('hidden');
    else loadingOverlay.classList.add('hidden');
}

function handleFileUpload(event) {
    const files = event.target.files;
    if (!files || files.length === 0) {
        console.warn("No files selected");
        return;
    }

    console.log(`Processing ${files.length} files`);

    // Cleanup existing scenes to free memory and reset state
    if (scenes.length > 0) {
        scenes.forEach(scene => URL.revokeObjectURL(scene.url));
        scenes = [];
        currentSceneIndex = -1;
    }

    // Convert FileList to Array and process
    const newScenes = Array.from(files).map((file, i) => ({
        name: `Scene ${scenes.length + i + 1}`,
        file: file,
        url: URL.createObjectURL(file)
    }));

    // Add to scenes array
    scenes = [...scenes, ...newScenes]; // Append correctly

    // Show the scenes section if hidden
    if (scenesSection) scenesSection.classList.remove('hidden');

    // Render list
    renderSceneList();

    // Always load the first scene of the new batch
    loadScene(0);

    // Reset input so same files can be selected again
    event.target.value = '';
}

function renderSceneList() {
    if (!sceneItemsContainer) return;

    sceneItemsContainer.innerHTML = '';

    scenes.forEach((sceneData, index) => {
        const item = document.createElement('div');
        item.className = `scene-item ${index === currentSceneIndex ? 'active' : ''}`;
        item.textContent = sceneData.name;
        item.onclick = () => loadScene(index);
        sceneItemsContainer.appendChild(item);
    });
}

function loadScene(index) {
    if (index < 0 || index >= scenes.length) return;

    currentSceneIndex = index;
    renderSceneList(); // Update active state

    const sceneData = scenes[index];
    // showLoading(true); // Removed to allow smooth transition overlay to work

    // Transition: Fade Out (Black Screen)
    if (transitionOverlay) transitionOverlay.classList.add('active');
    if (transitionOverlay) transitionOverlay.classList.add('active');

    // Wait for fade out to complete (500ms CSS transition) before loading
    setTimeout(() => {
        const extension = sceneData.name.split('.').pop().toLowerCase();
        const url = sceneData.url;

        const onLoad = (texture) => {
            console.log(`Texture ${sceneData.name} loaded successfully`);
            texture.mapping = THREE.EquirectangularReflectionMapping;
            texture.colorSpace = THREE.SRGBColorSpace;

            createSphere(texture);

            // Wait a moment for render, then Fade In
            requestAnimationFrame(() => {
                if (transitionOverlay) transitionOverlay.classList.remove('active');
                showLoading(false);

                // Entry Zoom Effect
                animateEntryZoom();
            });
        };

        const onError = (err) => {
            console.error("Error loading texture:", err);
            alert(`Error loading image: ${err.message || 'Invalid format'}`);
            showLoading(false);
            if (transitionOverlay) transitionOverlay.classList.remove('active');
        };

        if (extension === 'hdr') {
            const loader = new RGBELoader();
            loader.load(url, (texture) => {
                console.log("HDR loaded");

                // Adjust HDR properties if needed
                texture.mapping = THREE.EquirectangularReflectionMapping;

                createSphere(texture);

                requestAnimationFrame(() => {
                    if (transitionOverlay) transitionOverlay.classList.remove('active');
                    showLoading(false);
                    animateEntryZoom();
                });

            }, undefined, onError);
        } else {
            const loader = new THREE.TextureLoader();
            loader.load(url, onLoad, undefined, onError);
        }
    }, 500); // Sync with CSS transition time
}

function animateEntryZoom() {
    const targetFov = defaultFov;
    const startFov = defaultFov * 0.5; // Start zoomed in
    camera.fov = startFov;
    camera.updateProjectionMatrix();

    let startTime = null;
    const duration = 1500; // ms

    function zoomStep(timestamp) {
        if (!startTime) startTime = timestamp;
        const progress = Math.min((timestamp - startTime) / duration, 1);

        // Ease Out Cubic
        const ease = 1 - Math.pow(1 - progress, 3);

        camera.fov = startFov + (targetFov - startFov) * ease;
        camera.updateProjectionMatrix();

        if (progress < 1) {
            requestAnimationFrame(zoomStep);
        }
    }

    requestAnimationFrame(zoomStep);
}


function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}
