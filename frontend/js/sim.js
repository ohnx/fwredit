/* global Ammo, THREE, Stats */
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

  // Misc stuff
  var buttons = [false, false, false];

  // Physics variables
  var collisionConfiguration;
  var dispatcher;
  var broadphase;
  var solver;
  var physicsWorld;
  var time = 0;
  var syncList = [];
  
  // car control variables
  var desiredLeftSpeed = 0;
  var desiredRightSpeed = 0;

  var lbrh;

  // - Functions -
  function initGraphics() {
    container = document.getElementById('container');
    speedometer = document.getElementById('speedometer');

    scene = new THREE.Scene();

    camera = new THREE.PerspectiveCamera( 60, container.offsetWidth / container.offsetHeight, 0.2, 2000 );
    camera.position.x = -4.84;
    camera.position.y = 4.39;
    camera.position.z = -35.11;
    camera.lookAt( new THREE.Vector3( 0.33, -0.40, 0.85 ) );

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

    materialDynamic = new THREE.MeshPhongMaterial( { color:0xfca400 } );
    materialStatic = new THREE.MeshPhongMaterial( { color:0x999999 } );
    materialInteractive = new THREE.MeshPhongMaterial( { color:0x990000 } );

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
    for (var i = 0; i < syncList.length; i++)
      syncList[i](dt);
    physicsWorld.stepSimulation( dt, 10 );
    controls.update( dt );
    renderer.render( scene, camera );
    time += dt;
    stats.update();
  };

  function keyup(e) {
    if (this.simPause) return;
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
    var maxEngineForce = 2000;
    var maxBreakingForce = 100;

    // Chassis
    var geometry = new Ammo.btBoxShape(new Ammo.btVector3(chassisWidth / 2, chassisHeight / 2, chassisLength / 2));
    lbrh = geometry;
    window.lbrh2 = geometry;
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
    var chassisMesh = createChassisMesh(chassisWidth, chassisHeight, chassisLength);

    // Raycast Vehicle
    var tuning = new Ammo.btVehicleTuning();
    var rayCaster = new Ammo.btDefaultVehicleRaycaster(physicsWorld);
    var vehicle = new Ammo.btRaycastVehicle(tuning, body, rayCaster);
    vehicle.setCoordinateSystem(0, 1, 2);
    physicsWorld.addAction(vehicle);

    // Wheels
    // var FRONT_LEFT = 0;
    // var FRONT_RIGHT = 1;
    // var BACK_LEFT = 2;
    // var BACK_RIGHT = 3;
    var LEFT_WHEEL = 0;
    var RIGHT_WHEEL = 1;
    var wheelMeshes = [];
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
      wheelInfo.set_m_frictionSlip(friction);
      wheelInfo.set_m_rollInfluence(rollInfluence);

      wheelMeshes[index] = createWheelMesh(radius, width);
    }

    addWheel(false, new Ammo.btVector3(wheelHalfTrackBack, wheelAxisHeightBack, wheelAxisPositionBack), wheelRadiusBack, wheelWidthBack, LEFT_WHEEL);
    addWheel(false, new Ammo.btVector3(-wheelHalfTrackBack, wheelAxisHeightBack, wheelAxisPositionBack), wheelRadiusBack, wheelWidthBack, RIGHT_WHEEL);

    // Sync keybord actions and physics and graphics
    function sync(dt) {
      var speed = vehicle.getCurrentSpeedKmHour();

      speedometer.innerHTML = (speed < 0 ? '(R) ' : '') + Math.abs(speed).toFixed(1) + ' km/h';

      let leftForce = desiredLeftSpeed;
      let rightForce = desiredRightSpeed;

      vehicle.applyEngineForce(leftForce, LEFT_WHEEL);
      vehicle.applyEngineForce(rightForce, RIGHT_WHEEL);

      if (leftForce == 0 && rightForce == 0) {
        vehicle.setBrake(maxBreakingForce, LEFT_WHEEL);
        vehicle.setBrake(maxBreakingForce, RIGHT_WHEEL);
      }

      var tm, p, q, i;
      var n = vehicle.getNumWheels();
      for (i = 0; i < n; i++) {
        vehicle.updateWheelTransform(i, true);
        tm = vehicle.getWheelTransformWS(i);
        p = tm.getOrigin();
        q = tm.getRotation();
        wheelMeshes[i].position.set(p.x(), p.y(), p.z());
        wheelMeshes[i].quaternion.set(q.x(), q.y(), q.z(), q.w());
      }

      tm = vehicle.getChassisWorldTransform();
      p = tm.getOrigin();
      q = tm.getRotation();
      chassisMesh.position.set(p.x(), p.y(), p.z());
      chassisMesh.quaternion.set(q.x(), q.y(), q.z(), q.w());
      
      // raycast to see if we hit a box
      carPosition.set(p.x(), p.y(), p.z());
      forwardsDirection.set(q.x(), q.y(), q.z(), q.w());
      var vehiclePoint = new THREE.Vector3(0, 0, 1);
      vehiclePoint.applyQuaternion(forwardsDirection);
      raycaster.set(carPosition, vehiclePoint);
      var intersects = raycaster.intersectObjects(cubes);
      if (intersects.length > 0) {
        // intersected with something
        var intersect = intersects[0];
//            debugger;
        intersect.object.material.color.set('#0f0');
      }
    }

    syncList.push(sync);
  }

  function createObjects() {
    createBox(new THREE.Vector3(0, -0.5, 0), ZERO_QUATERNION, 75, 1, 75, 0, 2);

    var quaternion = new THREE.Quaternion(0, 0, 0, 1);
    quaternion.setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 18);
    createBox(new THREE.Vector3(0, -1.5, 0), quaternion, 8, 4, 10, 0);

    var size = .75;
    var nw = 8;
    var nh = 6;
    for (var j = 0; j < nw; j++)
      for (var i = 0; i < nh; i++)
        createBox(new THREE.Vector3(size * j - (size * (nw - 1)) / 2, size * i, 10), ZERO_QUATERNION, size, size, size, 10);

    createVehicle(new THREE.Vector3(0, 4, -20), ZERO_QUATERNION);
  }

  // - Init -
  initGraphics();
  initPhysics();
  createObjects();
  this.tick();
  
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
        console.log('assign left speed ', speed);
        desiredLeftSpeed = speed / 300 * 2000;
      },
      setRightSpeed: function(speed) {
        console.log('assign right speed ', speed);
        desiredRightSpeed = speed / 300 * 2000;
      }
    };

    // Buttons
    this.getButtonState = function(idx) {
      if (idx >= buttons.length || idx < 0) return 0;
      // use ints here to avoid bools
      console.log('button check: ', idx);
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
      serialCallback(str);
    };
  };
  this.API = new apiCode(this);

  this.run = function(path) {
    if (this.lastSimulationCode) {
      console.log('Clearing existing item');
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


