const canvas = document.getElementById("canvas");
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x08131e);
scene.fog = new THREE.Fog(0x08131e, 12, 80);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 500);
camera.position.set(0, 1.7, 10);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const clock = new THREE.Clock();

const hud = {
  wave: document.getElementById("waveCount"),
  zombies: document.getElementById("zombieCount"),
  kills: document.getElementById("killCount"),
  score: document.getElementById("scoreCount"),
  tokens: document.getElementById("tokenCount"),
  healthBar: document.getElementById("healthBar"),
  healthText: document.getElementById("healthText"),
  weaponName: document.getElementById("weaponName"),
  ammoBar: document.getElementById("ammoBar"),
  ammoText: document.getElementById("ammoText"),
  ammoMax: document.getElementById("ammoMax"),
  shopModal: document.getElementById("shopModal"),
  shopGrid: document.getElementById("shopGrid"),
  shopTokenDisplay: document.getElementById("shopTokenDisplay"),
  waveModal: document.getElementById("waveModal"),
  waveTitle: document.getElementById("waveTitle"),
  waveMessage: document.getElementById("waveMessage"),
  waveReward: document.getElementById("waveReward"),
  waveCountdown: document.getElementById("waveCountdown"),
  gameOverModal: document.getElementById("gameOverModal"),
  finalWave: document.getElementById("finalWave"),
  finalKills: document.getElementById("finalKills"),
  finalScore: document.getElementById("finalScore"),
  finalTokens: document.getElementById("finalTokens")
};

const config = {
  arenaSize: 46,
  playerSpeed: 9,
  sprintMultiplier: 1.35,
  gravity: 20,
  jumpForce: 8,
  reloadTime: 1.1,
  shootCooldown: 0.18,
  waveRewardTokens: 1000000,
  ammoPerMagazine: 30,
  weaponName: "Rifle"
};

const state = {
  wave: 1,
  kills: 0,
  score: 0,
  tokens: 0,
  health: 100,
  maxHealth: 100,
  ammo: 30,
  mag: 30,
  reloading: false,
  weaponName: "Rifle",
  activeWave: false,
  zombies: [],
  particles: [],
  shopOpen: false,
  isGameOver: false,
  spawnQueue: 0,
  spawnRatio: 1,
  nextWaveStartDelay: 0,
  lastShotAt: 0,
  mouseLook: { yaw: 0, pitch: 0 },
  move: { forward: false, backward: false, left: false, right: false, sprint: false },
  playerVelocity: new THREE.Vector3(),
  playerPosition: new THREE.Vector3(0, 1.7, 10),
  flash: 0,
  currentSkinId: "classic",
  activeSkin: null
};

const skinCatalog = [
  { id: "classic", name: "Classic", price: 0, color: 0x33cc66, weaponColor: 0x9fa8b3, defaultOwned: true },
  { id: "neon", name: "Neon", price: 100000, color: 0x00d1ff, weaponColor: 0x00e5ff, defaultOwned: false },
  { id: "crimson", name: "Crimson", price: 250000, color: 0xff3d5a, weaponColor: 0xff7f88, defaultOwned: false },
  { id: "shadow", name: "Shadow", price: 500000, color: 0x4e5d94, weaponColor: 0x8ea4d2, defaultOwned: false },
  { id: "gold", name: "Gold", price: 750000, color: 0xf7c948, weaponColor: 0xffdf73, defaultOwned: false },
  { id: "plasma", name: "Plasma", price: 1000000, color: 0xad5cff, weaponColor: 0xd9a7ff, defaultOwned: false }
];

const SAVE_KEY = "zombieShooterSkins_v1";
const ownedSkins = JSON.parse(localStorage.getItem(SAVE_KEY) || "{}");
for (const skin of skinCatalog) {
  if (skin.defaultOwned || ownedSkins[skin.id]) ownedSkins[skin.id] = true;
}
if (!ownedSkins.classic) ownedSkins.classic = true;

function saveInventory() {
  localStorage.setItem(SAVE_KEY, JSON.stringify(ownedSkins));
}

function getSkinById(id) {
  return skinCatalog.find((skin) => skin.id === id) || skinCatalog[0];
}

function updateHUD() {
  hud.wave.textContent = state.wave;
  hud.zombies.textContent = state.zombies.length;
  hud.kills.textContent = state.kills;
  hud.score.textContent = state.score.toLocaleString();
  hud.tokens.textContent = state.tokens.toLocaleString();
  hud.healthBar.style.width = `${(state.health / state.maxHealth) * 100}%`;
  hud.healthText.textContent = `${Math.ceil(state.health)}`;
  hud.weaponName.textContent = state.weaponName;
  hud.ammoBar.style.width = `${(state.ammo / state.mag) * 100}%`;
  hud.ammoText.textContent = state.ammo;
  hud.ammoMax.textContent = state.mag;
  hud.shopTokenDisplay.textContent = state.tokens.toLocaleString();
}

function buildEnvironment() {
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(config.arenaSize * 2.2, config.arenaSize * 2.2),
    new THREE.MeshStandardMaterial({ color: 0x182635, roughness: 0.95, metalness: 0.1 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  const grid = new THREE.GridHelper(config.arenaSize * 2, 32, 0x2cffb6, 0x112a22);
  grid.position.y = 0.02;
  scene.add(grid);

  const wallMaterial = new THREE.MeshStandardMaterial({ color: 0x2b3347, roughness: 0.85, metalness: 0.2 });
  const wallHeight = 5;
  const wallThickness = 1.5;
  const walls = [
    { x: 0, z: -config.arenaSize, w: config.arenaSize * 2, h: wallHeight, d: wallThickness },
    { x: 0, z: config.arenaSize, w: config.arenaSize * 2, h: wallHeight, d: wallThickness },
    { x: -config.arenaSize, z: 0, w: wallThickness, h: wallHeight, d: config.arenaSize * 2 },
    { x: config.arenaSize, z: 0, w: wallThickness, h: wallHeight, d: config.arenaSize * 2 }
  ];

  for (const wall of walls) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(wall.w, wall.h, wall.d), wallMaterial);
    mesh.position.set(wall.x, wall.h / 2, wall.z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
  }

  const crateMat = new THREE.MeshStandardMaterial({ color: 0x6d4c41, roughness: 0.9, metalness: 0.1 });
  for (let i = 0; i < 20; i++) {
    const crate = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2), crateMat);
    crate.position.set(
      THREE.MathUtils.randFloatSpread(config.arenaSize * 1.8),
      1,
      THREE.MathUtils.randFloatSpread(config.arenaSize * 1.8)
    );
    crate.castShadow = true;
    crate.receiveShadow = true;
    scene.add(crate);
  }

  const hemi = new THREE.HemisphereLight(0x9ecbff, 0x0f172a, 1.1);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(0xffffff, 1.2);
  sun.position.set(12, 18, 8);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -60;
  sun.shadow.camera.right = 60;
  sun.shadow.camera.top = 60;
  sun.shadow.camera.bottom = -60;
  scene.add(sun);

  const glow = new THREE.PointLight(0xff7a00, 1.4, 80, 2);
  glow.position.set(0, 10, 0);
  scene.add(glow);
}

function setupInput() {
  document.addEventListener("keydown", (event) => {
    const code = event.code;

    if (code === "KeyP") {
      if (!state.isGameOver) toggleShop();
      return;
    }

    if (code === "KeyR") {
      startReload();
      return;
    }

    if (code === "Space") {
      if (state.playerPosition.y <= 1.7 + 0.05) {
        state.playerVelocity.y = config.jumpForce;
      }
      return;
    }

    if (code === "KeyM") {
      canvas.requestPointerLock();
    }

    if (code === "KeyV") {
      if (document.pointerLockElement === canvas) document.exitPointerLock();
    }

    if (code === "KeyW") state.move.forward = true;
    if (code === "KeyS") state.move.backward = true;
    if (code === "KeyA") state.move.left = true;
    if (code === "KeyD") state.move.right = true;
    if (code === "ShiftLeft" || code === "ShiftRight") state.move.sprint = true;
  });

  document.addEventListener("keyup", (event) => {
    const code = event.code;
    if (code === "KeyW") state.move.forward = false;
    if (code === "KeyS") state.move.backward = false;
    if (code === "KeyA") state.move.left = false;
    if (code === "KeyD") state.move.right = false;
    if (code === "ShiftLeft" || code === "ShiftRight") state.move.sprint = false;
  });

  document.addEventListener("mousemove", (event) => {
    if (document.pointerLockElement !== canvas || state.shopOpen || state.isGameOver) return;
    state.mouseLook.yaw -= event.movementX * 0.0022;
    state.mouseLook.pitch -= event.movementY * 0.0017;
    state.mouseLook.pitch = THREE.MathUtils.clamp(state.mouseLook.pitch, -1.2, 1.2);
  });

  canvas.addEventListener("click", () => {
    if (!state.shopOpen && !state.isGameOver) {
      canvas.requestPointerLock();
      shoot();
    }
  });

  document.addEventListener("contextmenu", (event) => event.preventDefault());
}

function startReload() {
  if (state.reloading || state.ammo >= state.mag || state.shopOpen || state.isGameOver) return;
  state.reloading = true;
  state.weaponName = "Reloading...";
  updateHUD();

  setTimeout(() => {
    state.ammo = state.mag;
    state.reloading = false;
    state.weaponName = config.weaponName;
    updateHUD();
  }, config.reloadTime * 1000);
}

function shoot() {
  if (state.shopOpen || state.isGameOver || state.reloading) return;
  const now = performance.now();
  if (now - state.lastShotAt < config.shootCooldown * 1000) return;

  if (state.ammo <= 0) {
    startReload();
    return;
  }

  state.lastShotAt = now;
  state.ammo -= 1;
  updateHUD();

  const origin = camera.position.clone();
  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);

  const ray = new THREE.Raycaster(origin, dir, 0, 70);
  const targets = state.zombies.map((z) => z.mesh);
  const hits = ray.intersectObjects(targets, false);

  if (hits.length > 0) {
    const hit = hits[0].object;
    const zombie = state.zombies.find((z) => z.mesh === hit);
    if (zombie) {
      zombie.health -= 35;
      zombie.mesh.material.emissive = new THREE.Color(0xff5555);
      zombie.mesh.material.emissiveIntensity = 0.8;
      setTimeout(() => {
        if (zombie.mesh) zombie.mesh.material.emissive.setHex(0x000000);
      }, 80);

      if (zombie.health <= 0) {
        killZombie(zombie);
      }
    }
  }

  spawnMuzzleFlash();
  state.flash = 0.12;
}

function spawnMuzzleFlash() {
  const flash = new THREE.Mesh(
    new THREE.SphereGeometry(0.08, 8, 8),
    new THREE.MeshBasicMaterial({ color: 0xffdd66 })
  );
  flash.position.set(0.6, 1.35, -0.7).applyQuaternion(camera.quaternion).add(camera.position);
  scene.add(flash);
  state.particles.push({ mesh: flash, velocity: new THREE.Vector3(0, 0, 0), life: 0.12 });
}

function createZombie(type) {
  const z = {
    type,
    health: 100,
    speed: 2.2,
    damage: 12,
    radius: 0.8,
    attackCooldown: 0.8,
    mesh: null
  };

  let color = 0xff4d4d;
  let scale = 1;

  if (type === "runner") {
    z.health = 60;
    z.speed = 3.7;
    z.damage = 14;
    color = 0x4ef08d;
    scale = 0.75;
  } else if (type === "brute") {
    z.health = 240;
    z.speed = 1.35;
    z.damage = 23;
    color = 0xd7a978;
    scale = 1.7;
  }

  const mesh = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.5 * scale, 1.4 * scale, 4, 8),
    new THREE.MeshStandardMaterial({ color, emissive: new THREE.Color(color).multiplyScalar(0.2), roughness: 0.8, metalness: 0.05 })
  );

  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.position.set(0, 1.3 * scale, 0);

  scene.add(mesh);
  z.mesh = mesh;
  z.radius = 0.8 * scale;
  z.health = z.health;
  return z;
}

function spawnZombie() {
  if (state.isGameOver) return;

  let type = "walker";
  const roll = Math.random();
  if (roll < 0.2 && state.wave >= 2) type = "runner";
  if (roll > 0.86 && state.wave >= 4) type = "brute";

  const zombie = createZombie(type);
  const side = Math.floor(Math.random() * 4);

  if (side === 0) {
    zombie.mesh.position.set(Math.random() * config.arenaSize * 2 - config.arenaSize, 1.4 * (type === "brute" ? 1.7 : 1), -config.arenaSize - 2);
  } else if (side === 1) {
    zombie.mesh.position.set(Math.random() * config.arenaSize * 2 - config.arenaSize, 1.4 * (type === "brute" ? 1.7 : 1), config.arenaSize + 2);
  } else if (side === 2) {
    zombie.mesh.position.set(-config.arenaSize - 2, 1.4 * (type === "brute" ? 1.7 : 1), Math.random() * config.arenaSize * 2 - config.arenaSize);
  } else {
    zombie.mesh.position.set(config.arenaSize + 2, 1.4 * (type === "brute" ? 1.7 : 1), Math.random() * config.arenaSize * 2 - config.arenaSize);
  }

  state.zombies.push(zombie);
}

function killZombie(zombie) {
  if (!zombie || !zombie.mesh) return;

  scene.remove(zombie.mesh);
  state.zombies = state.zombies.filter((z) => z !== zombie);
  state.kills += 1;
  state.score += 100 * state.wave;
  state.tokens += 2500;
  createBloodBurst(zombie.mesh.position.clone());
  updateHUD();
}

function createBloodBurst(position) {
  for (let i = 0; i < 12; i++) {
    const p = new THREE.Mesh(
      new THREE.SphereGeometry(0.08, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xff3030 })
    );
    p.position.copy(position);
    p.position.y += 0.7;
    scene.add(p);
    state.particles.push({
      mesh: p,
      velocity: new THREE.Vector3(
        (Math.random() - 0.5) * 4,
        Math.random() * 2.5,
        (Math.random() - 0.5) * 4
      ),
      life: 0.6
    });
  }
}

function damagePlayer(amount) {
  state.health -= amount;
  state.flash = 0.2;
  updateHUD();
  if (state.health <= 0) {
    state.health = 0;
    triggerGameOver();
  }
}

function updateZombies(delta) {
  for (const zombie of state.zombies) {
    const dx = state.playerPosition.x - zombie.mesh.position.x;
    const dz = state.playerPosition.z - zombie.mesh.position.z;
    const dist = Math.hypot(dx, dz);
    if (dist > 0.01) {
      const dirX = dx / dist;
      const dirZ = dz / dist;
      zombie.mesh.position.x += dirX * zombie.speed * delta;
      zombie.mesh.position.z += dirZ * zombie.speed * delta;
      zombie.mesh.rotation.y = Math.atan2(dirX, dirZ);
    }

    zombie.attackCooldown -= delta;
    if (dist < 1.8 && zombie.attackCooldown <= 0) {
      damagePlayer(zombie.damage);
      zombie.attackCooldown = 0.8;
    }
  }
}

function updateParticles(delta) {
  for (let i = state.particles.length - 1; i >= 0; i--) {
    const p = state.particles[i];
    p.mesh.position.addScaledVector(p.velocity, delta);
    p.velocity.y -= 5 * delta;
    p.life -= delta;
    if (p.life <= 0) {
      scene.remove(p.mesh);
      state.particles.splice(i, 1);
    }
  }
}

function updatePlayerMovement(delta) {
  if (state.shopOpen || state.isGameOver) return;

  const forward = new THREE.Vector3(Math.sin(state.mouseLook.yaw), 0, Math.cos(state.mouseLook.yaw));
  const right = new THREE.Vector3(forward.z, 0, -forward.x);
  const moveDir = new THREE.Vector3();

  if (state.move.forward) moveDir.add(forward);
  if (state.move.backward) moveDir.sub(forward);
  if (state.move.left) moveDir.sub(right);
  if (state.move.right) moveDir.add(right);

  if (moveDir.lengthSq() > 0) {
    moveDir.normalize();
    const speed = state.move.sprint ? config.playerSpeed * config.sprintMultiplier : config.playerSpeed;
    state.playerPosition.x += moveDir.x * speed * delta;
    state.playerPosition.z += moveDir.z * speed * delta;
  }

  state.playerPosition.x = THREE.MathUtils.clamp(state.playerPosition.x, -config.arenaSize + 1.2, config.arenaSize - 1.2);
  state.playerPosition.z = THREE.MathUtils.clamp(state.playerPosition.z, -config.arenaSize + 1.2, config.arenaSize - 1.2);

  state.playerVelocity.y -= config.gravity * delta;
  state.playerPosition.y += state.playerVelocity.y * delta;
  if (state.playerPosition.y < 1.7) {
    state.playerPosition.y = 1.7;
    state.playerVelocity.y = 0;
  }
}

function updateCamera() {
  camera.position.copy(state.playerPosition);
  camera.position.y += 0.3;

  const lookTarget = new THREE.Vector3(
    camera.position.x + Math.sin(state.mouseLook.yaw) * 10,
    camera.position.y + Math.sin(state.mouseLook.pitch) * 8,
    camera.position.z + Math.cos(state.mouseLook.yaw) * 10
  );

  camera.lookAt(lookTarget);
}

function startWave(number) {
  state.wave = number;
  state.activeWave = true;
  state.spawnQueue = 5 + number * 2;
  state.spawnRatio = Math.max(0.45, 1.1 - number * 0.03);

  hud.waveModal.classList.add("active");
  hud.waveTitle.textContent = `WAVE ${number}`;
  hud.waveMessage.textContent = "Prepare to fight!";
  hud.waveReward.textContent = `🪙 ${config.waveRewardTokens.toLocaleString()} TOKENS`; 
  hud.waveCountdown.textContent = "Starting in 3...";

  let countdown = 3;
  const interval = setInterval(() => {
    countdown -= 1;
    if (countdown > 0) {
      hud.waveCountdown.textContent = `Starting in ${countdown}...`;
    } else {
      clearInterval(interval);
      hud.waveModal.classList.remove("active");
      hud.waveMessage.textContent = "Zombies incoming!";
    }
  }, 1000);

  setTimeout(() => {
    if (!state.isGameOver) {
      hud.waveMessage.textContent = "Survive the swarm!";
    }
  }, 2200);
}

function updateWaveSystem(delta) {
  if (!state.activeWave || state.isGameOver) return;

  if (state.spawnQueue > 0) {
    state.nextWaveStartDelay -= delta;
    if (state.nextWaveStartDelay <= 0) {
      spawnZombie();
      state.spawnQueue -= 1;
      state.nextWaveStartDelay = state.spawnRatio;
    }
  }

  if (state.spawnQueue === 0 && state.zombies.length === 0) {
    finishWave();
  }
}

function finishWave() {
  if (!state.activeWave || state.isGameOver) return;
  state.activeWave = false;
  state.tokens += config.waveRewardTokens;
  state.score += 5000 + state.wave * 1000;

  const note = document.createElement("div");
  note.className = "notification";
  note.textContent = `Wave ${state.wave} cleared! +${config.waveRewardTokens.toLocaleString()} tokens`;
  document.getElementById("gameContainer").appendChild(note);

  setTimeout(() => {
    note.remove();
  }, 2000);

  updateHUD();

  setTimeout(() => {
    if (!state.isGameOver) startWave(state.wave + 1);
  }, 1800);
}

function triggerGameOver() {
  if (state.isGameOver) return;
  state.isGameOver = true;
  state.activeWave = false;
  hud.finalWave.textContent = state.wave;
  hud.finalKills.textContent = state.kills;
  hud.finalScore.textContent = state.score.toLocaleString();
  hud.finalTokens.textContent = state.tokens.toLocaleString();
  hud.gameOverModal.classList.add("active");
  document.exitPointerLock();
}

function resetGame() {
  state.wave = 1;
  state.kills = 0;
  state.score = 0;
  state.tokens = 0;
  state.health = 100;
  state.maxHealth = 100;
  state.ammo = 30;
  state.mag = 30;
  state.reloading = false;
  state.activeWave = false;
  state.isGameOver = false;
  state.flash = 0;
  state.lastShotAt = 0;
  state.playerPosition.set(0, 1.7, 10);
  state.playerVelocity.set(0, 0, 0);
  state.mouseLook.yaw = 0;
  state.mouseLook.pitch = 0;

  for (const z of state.zombies) {
    scene.remove(z.mesh);
  }
  state.zombies = [];

  for (const p of state.particles) {
    scene.remove(p.mesh);
  }
  state.particles = [];

  hud.gameOverModal.classList.remove("active");
  updateHUD();
  startWave(1);
}

function applySkin(skinId) {
  const skin = getSkinById(skinId);
  state.currentSkinId = skin.id;
  state.activeSkin = skin;

  const bodyColor = new THREE.Color(skin.color);
  const weaponColor = new THREE.Color(skin.weaponColor);

  const weapon = document.documentElement;
  weapon.style.setProperty("--gun-glow", `#${weaponColor.getHexString()}`);

  // Weapon look is represented by the muzzle flash color, not an actual model.
  // Keep the player visually responsive to skin choice by tinting the UI crosshair.
  const crosshair = document.getElementById("crosshair");
  if (crosshair) {
    crosshair.style.filter = `drop-shadow(0 0 8px #${bodyColor.getHexString()})`;
  }

  updateHUD();
}

function renderShop() {
  hud.shopGrid.innerHTML = "";

  for (const skin of skinCatalog) {
    const owned = !!ownedSkins[skin.id];
    const card = document.createElement("div");
    card.className = "shop-item";

    const name = document.createElement("div");
    name.className = "shop-item-name";
    name.textContent = skin.name;

    const price = document.createElement("div");
    price.className = "shop-item-price";
    price.textContent = owned ? "Owned" : `${skin.price.toLocaleString()} 🪙`;

    const button = document.createElement("button");
    button.className = "shop-button";
    button.textContent = owned ? "Equip" : "Buy";
    button.disabled = !owned && state.tokens < skin.price;

    button.addEventListener("click", () => {
      if (owned) {
        applySkin(skin.id);
        toggleShop();
        return;
      }

      if (state.tokens >= skin.price) {
        state.tokens -= skin.price;
        ownedSkins[skin.id] = true;
        saveInventory();
        applySkin(skin.id);
        renderShop();
        updateHUD();
      }
    });

    const status = document.createElement("div");
    status.className = "shop-item-owned";
    status.textContent = owned ? "Equipped/owned" : "Cheap skin";

    card.appendChild(name);
    card.appendChild(price);
    card.appendChild(button);
    card.appendChild(status);
    hud.shopGrid.appendChild(card);
  }
}

function toggleShop() {
  if (state.isGameOver) return;
  state.shopOpen = !state.shopOpen;
  if (state.shopOpen) {
    hud.shopModal.classList.add("active");
    renderShop();
    document.exitPointerLock();
  } else {
    hud.shopModal.classList.remove("active");
    canvas.requestPointerLock();
  }
}

function closeShop() {
  if (state.shopOpen) {
    state.shopOpen = false;
    hud.shopModal.classList.remove("active");
    canvas.requestPointerLock();
  }
}

function animate() {
  requestAnimationFrame(animate);
  const delta = Math.min(clock.getDelta(), 0.033);

  if (!state.shopOpen && !state.isGameOver) {
    updatePlayerMovement(delta);
    updateZombies(delta);
    updateWaveSystem(delta);
  }

  updateParticles(delta);
  updateCamera();
  updateHUD();

  if (state.flash > 0) {
    state.flash = Math.max(0, state.flash - delta);
    document.body.style.filter = `brightness(${1 + (0.35 * (1 - state.flash / 0.2))})`;
  } else {
    document.body.style.filter = "none";
  }

  renderer.render(scene, camera);
}

buildEnvironment();
setupInput();
applySkin("classic");
updateHUD();
startWave(1);
animate();

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

window.restartGame = resetGame;
window.closeShop = closeShop;
