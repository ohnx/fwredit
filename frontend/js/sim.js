/* global Ammo, THREE, Stats, localStorage */

// The simulator exists in a 500x500 world
const WORLD_MAX = 200;
// car starts at x=0, y=1, z=-20

// number of pins
const NUM_PINS = 20;

let simulatorCode = function(Ammo) {
  // - Global variables -
  var DISABLE_DEACTIVATION = 4;
  var TRANSFORM_AUX = new Ammo.btTransform();
  var ZERO_QUATERNION = new THREE.Quaternion(0, 0, 0, 1);
  this.simPause = false;
  this.lastSimulationCode = null;
  var serialCallback;

  // Graphics variables
  var container, stats, speedometer;
  var camera, controls, scene, renderer;
  var terrainMesh, texture;
  var clock = new THREE.Clock();
  var materialDynamic, materialStatic, materialInteractive;
  var cubes = [];

  // Raytracing stuff
  var raycaster;
  var forwardsDirection, carPosition;
  var arrow = undefined;

  // Misc stuff
  var buttons = [false, false, false];
  var pinValues = new Array(NUM_PINS);
  for (let pVi = 0; pVi < NUM_PINS; pVi++) {
    pinValues[pVi] = 0;
  }

  // Physics variables
  var collisionConfiguration;
  var dispatcher;
  var broadphase;
  var solver;
  var physicsWorld;
  var syncList = [];
  var time = 0;
  // car stuff
  var mainVehicle;
  var vehicleChassisMesh;
  var vehicleWheelMeshes = [];
  var wheelRotations = [];
  var maxEngineForce = 2000;
  var maxBreakingForce = 5000;
  const LEFT_WHEEL = 0;
  const RIGHT_WHEEL = 1;

  // car control variables
  var desiredLeftSpeed = 0;
  var desiredRightSpeed = 0;
  var lastLeftSpeed = 0;
  var lastRightSpeed = 0;
  var leftBreakCounter = 0;
  var rightBreakCounter = 0;
  var leftBreakAmt = 0;
  var rightBreakAmt = 0;

  var pointingUp = new THREE.Vector3(0, 1, 0);

  // lab code
  function lab_init() {
    lab3_control_setup();
  }

  function lab_syncfunc(p, q) {
    lab3_control_syncfunc(p, q);
  }

  // LAB 3: CONTROL LAB CODE
  let trackMesh;
  let trackConfigs = {
    'basic': {
      model: 'models/lab3_basic.json',
      rotation: [Math.PI/2, 0, Math.PI/2],
      position: [13, -0.9, -12],
      scale: 0.02
    },
    'checkoff': {
      model: 'models/lab3_checkoff.json',
      rotation: [Math.PI/2, 0, Math.PI/2],
      position: [7, -0.9, -10],
      scale: 0.02
    },
    'hard': {
      model: 'models/lab3_hard.json',
      rotation: [Math.PI/2, 0, Math.PI/2],
      position: [7, -0.9, -10],
      scale: 0.02
    },
    'maze1': {
      model: 'models/lab4_maze_starter.json',
      rotation: [Math.PI/2, 0, 0],
      position: [-16.5, -2, 0],
      scale: 0.9
    },
    'maze2': {
      model: 'models/lab4_maze_harder.json',
      rotation: [Math.PI/2, 0, 0],
      position: [-21, -2, 0],
      scale: 0.9
    }
  };
  function lab3_load_track_config() {
    const DEFAULT_TRACK = 'basic';
    let currTrack = localStorage.getItem('CURRENT_TRACK');
    console.log('loaded track', currTrack);
    if (!currTrack) currTrack = DEFAULT_TRACK;
    document.getElementById('selectTrack').value = currTrack;
    document.getElementById('selectTrack').addEventListener('change', function() {
      localStorage.setItem('CURRENT_TRACK', document.getElementById('selectTrack').value);
      window.location.reload(false);
    });
    return currTrack;
  }
  function lab3_control_setup() {
    // load meshes
    let currTrack = lab3_load_track_config();
    var loader = new THREE.BufferGeometryLoader();
    loader.load(trackConfigs[currTrack].model, function(geometry) {
      geometry = geometry.scale(trackConfigs[currTrack].scale, trackConfigs[currTrack].scale, trackConfigs[currTrack].scale);
      trackMesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({color: '#000'}));
      trackMesh.rotation.fromArray(trackConfigs[currTrack].rotation);
      trackMesh.position.fromArray(trackConfigs[currTrack].position);
      scene.add(trackMesh);
    });
  }

  var debugArrows = new Array();
  var lastRobotState = false;
  let zBase = new THREE.Vector3(0, 1, 0);
  const EMITTERS_BASE = 5;
  function lab3_control_syncfunc(p, q) {
    // raytrace to the track
    carPosition.set(p.x(), p.y(), p.z());
    forwardsDirection.set(q.x(), q.y(), q.z(), q.w());

    // DEBUG: show arrows
    if (debugArrows.length > 0) {
      for (var dAi = 0; dAi < debugArrows.length; dAi++) {
        scene.remove(debugArrows[dAi]);
      }
      // reset the array
      debugArrows = [];
    }

    // generate the direction that will point down
    var facingDown = new THREE.Vector3(0, -1, 0);
    facingDown.applyQuaternion(forwardsDirection);

    // generate the forwards vector
    var facingFowards = new THREE.Vector3(0, 0, 1);
    facingFowards.applyQuaternion(forwardsDirection);
    var forwardsDirectionQuat = new THREE.Quaternion();
    forwardsDirectionQuat.setFromAxisAngle(zBase, 0 * Math.PI / 180);

    // this amount is the same for every vector
    var forwardsVec = facingFowards.clone();
    forwardsVec.applyQuaternion(forwardsDirectionQuat);
    
    // generate the left/right vector - this vector is the one that changes
    // to model the line reading sensor
    var tiltLeftQuat = new THREE.Quaternion();
    tiltLeftQuat.setFromAxisAngle(zBase, 90 * Math.PI / 180);
    var lrVec = facingFowards.clone();
    lrVec.applyQuaternion(tiltLeftQuat);

    let raytracedArrows = [];
    let lrScales = [0.9, 0.6, 0.3, 0, -0.3, -0.6, -0.9];
    // i would do this one, but it seems like my computer suffers a big
    // perf hit :<
    //let lrScales = [0.9, 0.7, 0.5, 0.3, 0.1, -0.1, -0.3, -0.5, -0.7, -0.9];
    for (var i = 0; i < lrScales.length; i++) {
      let currentRay = carPosition.clone();
      
      // all rays go forwards the same amount
      currentRay.add(forwardsVec);
      
      // not all rays go l/r the same
      currentRay.addScaledVector(lrVec, lrScales[i]);

      // DEBUG: show arrows
      debugArrows.push(new THREE.ArrowHelper(facingDown, currentRay, 100, 0x00ffff));
      scene.add(debugArrows[debugArrows.length - 1]);

      // add the raytracedArrows
      raytracedArrows.push(currentRay);
    }

    var traceRay = function(arrowVec) {
      raycaster.set(arrowVec, facingDown);
      if (!trackMesh) return false;
      var intersect = raycaster.intersectObject(trackMesh);
      return intersect.length > 0;
    };

    var total = 0;
    for (var i = 0; i < raytracedArrows.length; i++) {
      pinValues[i + EMITTERS_BASE] = traceRay(raytracedArrows[i]) ? 1023 : 0;
      total += pinValues[i + EMITTERS_BASE];
    }

    if (total == 0) {
      if (lastRobotState == true) {
        console.warn("ROBOT LEFT TRACK");
      }
      lastRobotState = false;
    } else {
      lastRobotState = true;
    }
  }

  // - Functions -
  function initGraphics() {
    container = document.getElementById('container');
    speedometer = document.getElementById('speedometer');

    scene = new THREE.Scene();

    camera = new THREE.PerspectiveCamera( 60, container.offsetWidth / container.offsetHeight, 0.2, 2000 );
    camera.position.x = -5;
    camera.position.y = 40;
    camera.position.z = -10;
    camera.lookAt(new THREE.Vector3(0, 0, 0));

    renderer = new THREE.WebGLRenderer({antialias:true});
    renderer.setClearColor( 0xbfd1e5 );
    renderer.setPixelRatio( window.devicePixelRatio );
    renderer.setSize( container.offsetWidth, container.offsetHeight );

    controls = new THREE.OrbitControls( camera, renderer.domElement );

    var ambientLight = new THREE.AmbientLight( 0x404040 );
    scene.add( ambientLight );

    var dirLight = new THREE.DirectionalLight( 0xffffff, 1 );
    dirLight.position.set( 10, 10, 5 );
    scene.add( dirLight );

    var dirLight2 = new THREE.DirectionalLight( 0xffffff, 0.3 );
    dirLight2.position.set( 0, 4, -2 );
    scene.add( dirLight2 );

    materialDynamic = new THREE.MeshPhongMaterial( { color:0xfca400 } );
    materialStatic = new THREE.MeshPhongMaterial( { color:0xffffff } );
    materialInteractive = new THREE.MeshPhongMaterial( { color:0xdd0000 } );

    // raytracing
    raycaster = new THREE.Raycaster();
    forwardsDirection = new THREE.Quaternion();
    carPosition = new THREE.Vector3();

    container.innerHTML = "";
    container.appendChild(renderer.domElement);

    stats = new Stats();
    stats.domElement.style.position = 'absolute';
    stats.domElement.style.top = '0px';
    container.appendChild(stats.domElement);

    container.addEventListener('resize', onWindowResize, false);
    container.addEventListener('keydown', keydown);
    container.addEventListener('keyup', keyup);
  }

  function onWindowResize() {
    camera.aspect = container.innerWidth / container.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize( container.innerWidth, container.innerHeight );
  }

  function initPhysics() {
    // Physics configuration
    collisionConfiguration = new Ammo.btDefaultCollisionConfiguration();
    dispatcher = new Ammo.btCollisionDispatcher( collisionConfiguration );
    broadphase = new Ammo.btDbvtBroadphase();
    solver = new Ammo.btSequentialImpulseConstraintSolver();
    physicsWorld = new Ammo.btDiscreteDynamicsWorld( dispatcher, broadphase, solver, collisionConfiguration );
    physicsWorld.setGravity( new Ammo.btVector3( 0, -9.82, 0 ) );
  }

  this.tick = function() {
    if (this.simPause) return;
    requestAnimationFrame(this.tick.bind(this));
    var dt = clock.getDelta();
    time += dt;
    for (var i = 0; i < syncList.length; i++)
      syncList[i](dt);
    physicsWorld.stepSimulation(dt, 10);
    //controls.update( dt );
    renderer.render( scene, camera );
    stats.update();
  };

  function keyup(e) {
    if (this.simPause) return;
    /*if (e.keyCode == 81) { // 'q', aka "move camera to robot"
    //     createVehicle(new THREE.Vector3(0, 1, -20), ZERO_QUATERNION);
    // camera.position.x = -10;
    // camera.position.y = 10;
    // camera.position.z = -30;
    // camera.lookAt(new THREE.Vector3(0, 0, 0));
      controls.dispose();
      camera.position.x = carPosition.x - 10;
      camera.position.y = carPosition.y + 10;
      camera.position.z = carPosition.z - 10;
      camera.lookAt(carPosition);
      controls = new THREE.OrbitControls(camera, renderer.domElement);
    }*/
    /*if(keysActions[e.code]) {
      actions[keysActions[e.code]] = false;
      e.preventDefault();
      e.stopPropagation();
      return false;
    }*/
  }
  function keydown(e) {
    if (this.simPause) return;
    /*if(keysActions[e.code]) {
      actions[keysActions[e.code]] = true;
      e.preventDefault();
      e.stopPropagation();
      return false;
    }*/
  }

  function createBox(pos, quat, w, l, h, mass, friction) {
    var material = mass > 0 ? new THREE.MeshPhongMaterial( { color:0xfca400 } ) : materialStatic;
    var shape = new THREE.BoxGeometry(w, l, h, 1, 1, 1);
    var geometry = new Ammo.btBoxShape(new Ammo.btVector3(w * 0.5, l * 0.5, h * 0.5));

    if(!mass) mass = 0;
    if(!friction) friction = 1;

    var mesh = new THREE.Mesh(shape, material);
    mesh.position.copy(pos);
    mesh.quaternion.copy(quat);
    scene.add( mesh );

    var transform = new Ammo.btTransform();
    transform.setIdentity();
    transform.setOrigin(new Ammo.btVector3(pos.x, pos.y, pos.z));
    transform.setRotation(new Ammo.btQuaternion(quat.x, quat.y, quat.z, quat.w));
    var motionState = new Ammo.btDefaultMotionState(transform);

    var localInertia = new Ammo.btVector3(0, 0, 0);
    geometry.calculateLocalInertia(mass, localInertia);

    var rbInfo = new Ammo.btRigidBodyConstructionInfo(mass, motionState, geometry, localInertia);
    var body = new Ammo.btRigidBody(rbInfo);

    body.setFriction(friction);
    //body.setRestitution(.9);
    //body.setDamping(0.2, 0.2);

    physicsWorld.addRigidBody(body);

    if (mass > 0) {
      body.setActivationState(DISABLE_DEACTIVATION);
      // This body will be moved, so update the raycasting stuff too
      cubes.push(mesh);
      // Sync physics and graphics
      function sync(dt) {
        var ms = body.getMotionState();
        if (ms) {
          ms.getWorldTransform(TRANSFORM_AUX);
          var p = TRANSFORM_AUX.getOrigin();
          var q = TRANSFORM_AUX.getRotation();
          mesh.position.set(p.x(), p.y(), p.z());
          mesh.quaternion.set(q.x(), q.y(), q.z(), q.w());
        }
      }

      syncList.push(sync);
    }
  }

  function createWheelMesh(radius, width) {
    var t = new THREE.CylinderGeometry(radius, radius, width, 24, 1);
    t.rotateZ(Math.PI / 2);
    var mesh = new THREE.Mesh(t, materialInteractive);
    mesh.add(new THREE.Mesh(new THREE.BoxGeometry(width * 1.5, radius * 1.75, radius*.25, 1, 1, 1), materialInteractive));
    scene.add(mesh);
    return mesh;
  }

  function createChassisMesh(w, h, l) {
    var shape = new THREE.CylinderGeometry(w/2, l/2, h, 24, 1);
    var mesh = new THREE.Mesh(shape, materialInteractive);
    scene.add(mesh);
    return mesh;
  }

  // Sync keybord actions and physics and graphics
  function car_sync(dt) {
    var speed = mainVehicle.getCurrentSpeedKmHour();

    speedometer.innerHTML = (speed < 0 ? '(R) ' : '') + Math.abs(speed).toFixed(1) + ' km/h';

    // update the vehicle position
    var tm, p, q, i;
    tm = mainVehicle.getChassisWorldTransform();
    p = tm.getOrigin();
    q = tm.getRotation();
    vehicleChassisMesh.position.set(p.x(), p.y(), p.z());
    vehicleChassisMesh.quaternion.set(q.x(), q.y(), q.z(), q.w());

    // direction vehicle points in
    var localVehiclePoint = new THREE.Vector3(0, 0, 1);
    localVehiclePoint.applyQuaternion(vehicleChassisMesh.quaternion);

    // update the wheels
    var newWheelRotations = [];
    var n = mainVehicle.getNumWheels();
    for (i = 0; i < n; i++) {
      mainVehicle.updateWheelTransform(i, true);
      tm = mainVehicle.getWheelTransformWS(i);
      p = tm.getOrigin();
      q = tm.getRotation();
      vehicleWheelMeshes[i].position.set(p.x(), p.y(), p.z());
      vehicleWheelMeshes[i].quaternion.set(q.x(), q.y(), q.z(), q.w());
      // get a vector representing the new wheel's rotation
      var wheelVector = pointingUp.clone();
      wheelVector.applyQuaternion(vehicleWheelMeshes[i].quaternion);
      newWheelRotations[i] = wheelVector.angleTo(localVehiclePoint);
    }

    // do the math for the speed
    let leftForce = desiredLeftSpeed;
    let rightForce = desiredRightSpeed;

    // for this lab only, scale down the speed (cap it at 5 km/h)
    scale = 1 - 0.05*speed*speed;
    //if (scale < 0) scale = 0;

    if (leftForce == 0) {
      mainVehicle.setBrake(maxBreakingForce, LEFT_WHEEL);
    } else {
      leftForce *= scale;
    }
    if (rightForce == 0) {
      mainVehicle.setBrake(maxBreakingForce, RIGHT_WHEEL);
    } else {
      rightForce *= scale;
    }

    if (lastLeftSpeed > desiredLeftSpeed) {
      leftBreakAmt = lastLeftSpeed - desiredLeftSpeed;
      leftBreakCounter = 10;
    }
    if (leftBreakCounter) {
      mainVehicle.applyEngineForce(-leftBreakAmt * 2, LEFT_WHEEL);
      leftBreakCounter--;
    } else {
      mainVehicle.applyEngineForce(leftForce, LEFT_WHEEL);
    }

    if (lastRightSpeed > desiredRightSpeed) {
      rightBreakCounter = 10;
      rightBreakAmt = (lastRightSpeed - desiredRightSpeed);
    }
    if (rightBreakCounter) {
      mainVehicle.applyEngineForce(-rightBreakAmt * 2, RIGHT_WHEEL);
      rightBreakCounter--;
    } else {
      mainVehicle.applyEngineForce(rightForce, RIGHT_WHEEL);
    }

    lastLeftSpeed = desiredLeftSpeed;
    lastRightSpeed = desiredRightSpeed;

    // update wheel rotations
    wheelRotations = newWheelRotations;

    tm = mainVehicle.getChassisWorldTransform();
    p = tm.getOrigin();
    q = tm.getRotation();

    // call lab-dependent sync code 
    lab_syncfunc(p, q);
  }

  function createVehicle(pos, quat) {
    // Vehicle contants
    var chassisWidth = 3;
    var chassisHeight = .6;
    var chassisLength = 3;
    var massVehicle = 800;

    var wheelAxisPositionBack = 0;
    var wheelRadiusBack = .75;
    var wheelWidthBack = .3;
    var wheelHalfTrackBack = 1.2;
    var wheelAxisHeightBack = .3;

    var friction = 1000;
    var suspensionStiffness = 20.0;
    var suspensionDamping = 2.3;
    var suspensionCompression = 4.4;
    var suspensionRestLength = 0.6;
    var rollInfluence = 0.2;

    var steeringIncrement = .04;
    var steeringClamp = .5;

    // Chassis
    var geometry = new Ammo.btCompoundShape();
    // Main body
    var geometry1 = new Ammo.btBoxShape(new Ammo.btVector3(chassisWidth / 2, chassisHeight / 2, chassisLength / 2));
    // add main body to geometry
    var geo1Transform = new Ammo.btTransform();
    geo1Transform.setIdentity();
    geometry.addChildShape(geo1Transform, geometry1);

    // Ball to balance #1
    var geometry2 = new Ammo.btSphereShape(chassisHeight / 2);
    // add ball to balance #1 to geometry
    var geo2Transform = new Ammo.btTransform();
    geo2Transform.setIdentity();
    geo2Transform.setOrigin(new Ammo.btVector3(0, -chassisHeight / 2 - 0.2, -chassisLength / 2));
    geometry.addChildShape(geo2Transform, geometry2);

    // Ball to balance #2
    var geometry3 = new Ammo.btSphereShape(chassisHeight / 2);
    // add ball to balance #2 to geometry
    var geo3Transform = new Ammo.btTransform();
    geo3Transform.setIdentity();
    geo3Transform.setOrigin(new Ammo.btVector3(0, -chassisHeight / 2 - 0.2, chassisLength / 2));
    geometry.addChildShape(geo3Transform, geometry3);

    // misc
    var transform = new Ammo.btTransform();
    transform.setIdentity();
    transform.setOrigin(new Ammo.btVector3(pos.x, pos.y, pos.z));
    transform.setRotation(new Ammo.btQuaternion(quat.x, quat.y, quat.z, quat.w));
    var motionState = new Ammo.btDefaultMotionState(transform);
    var localInertia = new Ammo.btVector3(0, 0, 0);
    geometry.calculateLocalInertia(massVehicle, localInertia);
    var body = new Ammo.btRigidBody(new Ammo.btRigidBodyConstructionInfo(massVehicle, motionState, geometry, localInertia));
    body.setActivationState(DISABLE_DEACTIVATION);
    physicsWorld.addRigidBody(body);
    vehicleChassisMesh = createChassisMesh(chassisWidth, chassisHeight, chassisLength);

    // Raycast Vehicle
    var tuning = new Ammo.btVehicleTuning();
    var rayCaster = new Ammo.btDefaultVehicleRaycaster(physicsWorld);
    var vehicle = new Ammo.btRaycastVehicle(tuning, body, rayCaster);
    vehicle.setCoordinateSystem(0, 1, 2);
    physicsWorld.addAction(vehicle);
    mainVehicle = vehicle;

    // Wheels
    // var FRONT_LEFT = 0;
    // var FRONT_RIGHT = 1;
    // var BACK_LEFT = 2;
    // var BACK_RIGHT = 3;
    var wheelDirectionCS0 = new Ammo.btVector3(0, -1, 0);
    var wheelAxleCS = new Ammo.btVector3(-1, 0, 0);

    function addWheel(isFront, pos, radius, width, index) {
      var wheelInfo = vehicle.addWheel(
          pos,
          wheelDirectionCS0,
          wheelAxleCS,
          suspensionRestLength,
          radius,
          tuning,
          isFront);

      wheelInfo.set_m_suspensionStiffness(suspensionStiffness);
      wheelInfo.set_m_wheelsDampingRelaxation(suspensionDamping);
      wheelInfo.set_m_wheelsDampingCompression(suspensionCompression);
      wheelInfo.set_m_frictionSlip(friction*100);
      wheelInfo.set_m_rollInfluence(rollInfluence);

      vehicleWheelMeshes[index] = createWheelMesh(radius, width);
    }

    addWheel(false, new Ammo.btVector3(wheelHalfTrackBack, wheelAxisHeightBack, wheelAxisPositionBack), wheelRadiusBack, wheelWidthBack, LEFT_WHEEL);
    addWheel(false, new Ammo.btVector3(-wheelHalfTrackBack, wheelAxisHeightBack, wheelAxisPositionBack), wheelRadiusBack, wheelWidthBack, RIGHT_WHEEL);

    syncList.push(car_sync);
  }

  function createObjects() {
    //function createBox(pos, quat, w, l, h, mass, friction) {
    // ground
    createBox(new THREE.Vector3(0, -0.5, 0), ZERO_QUATERNION, WORLD_MAX, 1, WORLD_MAX, 0, 3);

    //var quaternion = new THREE.Quaternion(0, 0, 0, 1);
    //quaternion.setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 18);
    //createBox(new THREE.Vector3(0, -1.5, 0), quaternion, 8, 4, 10, 0);

    //var size = .75;
    //var nw = 8;
    //var nh = 6;
    //for (var j = 0; j < nw; j++)
    //  for (var i = 0; i < nh; i++)
    //    createBox(new THREE.Vector3(size * j - (size * (nw - 1)) / 2, size * i, 10), ZERO_QUATERNION, size, size, size, 10);

    createVehicle(new THREE.Vector3(0, 1, 0), ZERO_QUATERNION);

    // call lab code
    lab_init();
  }

  // - Init -
  initGraphics();
  initPhysics();
  createObjects();
  this.tick();



// BEGIN BLOCK - API CODE










  // Controls
  this.play = function() {
    this.simPause = false;
    this.tick();
  };
  
  this.pause = function() {
    this.simPause = true;
  };

  document.getElementById('btnA').addEventListener('click', function(e) {
    if (!buttons[0]) {
      buttons[0] = true;
      document.getElementById('btnA').classList.add('enabled');
      setTimeout(function() {
        document.getElementById('btnA').classList.remove('enabled');
        buttons[0] = false;
      }, 500);
    }
  });

  document.getElementById('btnB').addEventListener('click', function(e) {
    if (!buttons[1]) {
      buttons[1] = true;
      document.getElementById('btnB').classList.add('enabled');
      setTimeout(function() {
        document.getElementById('btnB').classList.remove('enabled');
        buttons[1] = false;
      }, 500);
    }
  });

  document.getElementById('btnC').addEventListener('click', function(e) {
    if (!buttons[2]) {
      buttons[2] = true;
      document.getElementById('btnC').classList.add('enabled');
      setTimeout(function() {
        document.getElementById('btnC').classList.remove('enabled');
        buttons[2] = false;
      }, 500);
    }
  });

  // API
  let apiCode = function(sim) {
    // Motors
    this.Motors = {
      setLeftSpeed: function(speed) {
        desiredLeftSpeed = speed / 300 * 2000;
      },
      setRightSpeed: function(speed) {
        desiredRightSpeed = speed / 300 * 2000;
      }
    };

    // Buttons
    this.getButtonState = function(idx) {
      if (idx >= buttons.length || idx < 0) return 0;
      // use ints here to avoid bools
      return buttons[idx] ? 1 : 0;
    };

    // LEDs
    this.ledRed = function(state) {
      let led = document.getElementById('ledA');
      if (state) {
        if (!led.classList.contains('enabled'))
          led.classList.add('enabled');
      } else {
        if (led.classList.contains('enabled'))
          led.classList.remove('enabled');
      }
    };
    this.ledYellow = function(state) {
      let led = document.getElementById('ledB');
      if (state) {
        if (!led.classList.contains('enabled'))
          led.classList.add('enabled');
      } else {
        if (led.classList.contains('enabled'))
          led.classList.remove('enabled');
      }
    };
    this.ledGreen = function(state) {
      let led = document.getElementById('ledC');
      if (state) {
        if (!led.classList.contains('enabled'))
          led.classList.add('enabled');
      } else {
        if (led.classList.contains('enabled'))
          led.classList.remove('enabled');
      }
    };

    // serial
    this.serialPrint = function(str) {
      if (serialCallback) serialCallback(str);
    };

    // analog read
    this.readPin = function(pin) {
      if (pin >= NUM_PINS || pin < 0) return 0;
      // expect pin states to be correct [0, 1023] int already
      return pinValues[pin];
    };
  };
  this.API = new apiCode(this);

  this.run = function(path) {
    if (this.lastSimulationCode) {
      document.head.removeChild(document.getElementById(this.lastSimulationCode));
      Module = Object.assign({}, defaultModule);
    }
    loadScript(path, function(elemId) {
      console.log('script loaded into', elemId);
      this.lastSimulationCode = elemId;
    }.bind(this));
  };

  this.registerSerialReceiver = function(cbfn) {
    serialCallback = cbfn;
  };
};

let Simulator;
let SimulatorAPI;

Ammo().then(function(Ammo) {
  Simulator = new simulatorCode(Ammo);
  window.Simulator = Simulator;
  SimulatorAPI = Simulator.API;
  window.SimulatorAPI = SimulatorAPI;
  if (parent && parent.simulatorReadyCallback) {
    parent.simulatorReadyCallback();
  } else {
    /* no parent, so let's just run stuff for ourselves */
    let lastKnownFile = localStorage.getItem('FILE_LOC');
    if (lastKnownFile) {
      Simulator.run(lastKnownFile);
    }
  }
});

/* glue code here */
let randomId = function() {
  return String.fromCharCode(65 + Math.floor(Math.random() * 26)) + Date.now();
};

let loadScript = function(url, callback) {
  if (!url) return;
  // Adding the script tag to the head as suggested before
  var head = document.head;
  var script = document.createElement('script');
  script.type = 'text/javascript';
  script.src = url;
  var elemId = randomId();
  script.id = elemId;

  // Then bind the event to the callback function.
  // There are several events for cross browser compatibility.
  script.onreadystatechange = function() {callback(elemId);};
  script.onload = function() {callback(elemId)};

  // Fire the loading
  head.appendChild(script);
};

var defaultModule = {
  onRuntimeInitialized: function() {
    console.log('Loaded user code! Running now...');

    // run the code
    Module.GlueCode_setupAndRun();
  }
};

var Module = Object.assign({}, defaultModule);


