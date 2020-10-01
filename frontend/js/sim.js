/* global Ammo, THREE, Stats, localStorage */

// The simulator exists in a 500x500 world
const WORLD_MAX = 200;
// car starts at x=0, y=1, z=-20

// number of pins
const NUM_PINS = 20;

let randomizeLightPosn = function() {
  let newLightPosn = {xPos: 0, zPos: 0};

  var xSgn = Math.random() > 0.5;
  var xPos = Math.random() * (WORLD_MAX/2 - 50) + 40;
  newLightPosn.xPos = xSgn ? xPos : -xPos;
  var zSgn = Math.random() > 0.5;
  var zPos = Math.random() * (WORLD_MAX/2 - 50) + 40;
  newLightPosn.zPos = zSgn ? zPos : -zPos;

  localStorage.setItem('LIGHT_POSITION', JSON.stringify(newLightPosn));
  return newLightPosn;
};

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
  var time = 0;
  var syncList = [];
  // car stuff
  var mainVehicle;
  var vehicleChassisMesh;
  var vehicleWheelMeshes = [];
  var maxEngineForce = 2000;
  var maxBreakingForce = 5000;
  const LEFT_WHEEL = 0;
  const RIGHT_WHEEL = 1;

  // car control variables
  var desiredLeftSpeed = 0;
  var desiredRightSpeed = 0;

  // lab code
  function lab_init() {
    lab2_photovore_setup();
  }

  // LAB 2: PHOTOVORE CODE
  var lab2_light;
  var leftSensorOffset;
  var rightSensorOffset;

  function lab2_photovore_setup() {
    // the light
    var geometry = new THREE.SphereBufferGeometry(2, 32, 32);
    var material = new THREE.MeshBasicMaterial({color: 0xffff00});
    lab2_light = new THREE.Mesh(geometry, material);
    // store the last used position of the light
    let lastLightPosn = localStorage.getItem('LIGHT_POSITION');
    if (lastLightPosn) {
      lastLightPosn = JSON.parse(lastLightPosn);
    } else {
      lastLightPosn = randomizeLightPosn();
    }
    lab2_light.position.set(lastLightPosn.xPos, 2, lastLightPosn.zPos);
    scene.add(lab2_light);

    // the sensors' offsets (as a percentage of the main reading from -15% to 15%)
    leftSensorOffset = localStorage.getItem('LEFT_SENSOR_OFFSET');
    if (!leftSensorOffset) {
      leftSensorOffset = 0.85 + Math.random() * 0.30; // random offset
    }
    rightSensorOffset = localStorage.getItem('RIGHT_SENSOR_OFFSET');
    if (!rightSensorOffset) {
      rightSensorOffset = 0.85 + Math.random() * 0.30; // random offset
    }
  }

  var debugArrows = new Array();
  function lab2_photovore_syncfunc(p, q) {
    // raycast to see if we hit a box
    carPosition.set(p.x(), p.y(), p.z());
    forwardsDirection.set(q.x(), q.y(), q.z(), q.w());
    var vehiclePoint = new THREE.Vector3(0, 0, 1.5);
    vehiclePoint.applyQuaternion(forwardsDirection);

    // DEBUG: show arrows
    if (arrow) scene.remove(arrow);
    arrow = new THREE.ArrowHelper(vehiclePoint, carPosition, 100, 0xff0000);
    scene.add(arrow);
    if (debugArrows.length > 0) {
      for (var dAi = 0; dAi < debugArrows.length; dAi++) {
        scene.remove(debugArrows[dAi]);
      }
      // reset the array
      debugArrows = [];
    }

    var leftSensorValue = 0;
    var rightSensorValue = 0;

    var leftLightStartingPosn = carPosition.clone();
    var llSPtiltedQuat = new THREE.Quaternion();
    llSPtiltedQuat.setFromAxisAngle(new THREE.Vector3(0, 1, 0), -45 * Math.PI / 180);
    var llSPtiltedVec = vehiclePoint.clone();
    llSPtiltedVec.applyQuaternion(llSPtiltedQuat);
    leftLightStartingPosn.add(llSPtiltedVec);

    var rightLightStartingPosn = carPosition.clone();
    var rlSPtiltedQuat = new THREE.Quaternion();
    rlSPtiltedQuat.setFromAxisAngle(new THREE.Vector3(0, 1, 0), 45 * Math.PI / 180);
    var rlSPtiltedVec = vehiclePoint.clone();
    rlSPtiltedVec.applyQuaternion(rlSPtiltedQuat);
    rightLightStartingPosn.add(rlSPtiltedVec);

    var traceRay = function(isLeft, angle) {
      var tiltedQuat = new THREE.Quaternion();
      tiltedQuat.setFromAxisAngle(new THREE.Vector3(0, 1, 0), angle * Math.PI / 180);
      var tiltedVec = vehiclePoint.clone();
      tiltedVec.applyQuaternion(tiltedQuat);
      var startingPos = isLeft ? leftLightStartingPosn : rightLightStartingPosn;

      // debug - show the rays
      if (isLeft)
        debugArrows.push(new THREE.ArrowHelper(tiltedVec, startingPos, 100, 0x3300ff));
      else
        debugArrows.push(new THREE.ArrowHelper(tiltedVec, startingPos, 100, 0x00ffff));
      scene.add(debugArrows[debugArrows.length - 1]);

      // trace the ray
      raycaster.set(startingPos, tiltedVec);
      var intersects = raycaster.intersectObject(lab2_light);
      if (intersects.length > 0) {
        var intersect = intersects[0];
        // ookayy time to compute the value of the brightness!
        var baseBrightness = 0;
        // first off is the distance. max distance is 200, but if we
        // collide, i still want to show at least a little bit vs. 0.
        // at some point, we want to have near-1024
        // for now, let's try the equation 1000000/(x+60)^2
        // (we want to decay the brightness squared; this seems most realistic)
        var iDr = intersect.distance + 60;
        baseBrightness = 1000000/(iDr * iDr);
        // next, we want to consider the angle at which the ray is cast.
        // the more "off" it is, the less it should count.
        // +/- 3 is the midpoint here
        var offNess = 0;
        if (isLeft) offNess = angle + 3;
        else offNess = angle - 3;
        offNess = Math.abs(offNess);
        // so the range of offness is [0, 7]... at 0 offness, we want to keep
        // the value at 1.
        // for now, let's try the equation 1-0.1x
        baseBrightness *= (1 - (0.1 * offNess));
        // finally, let's add a bit of noise. readings can vary a little bit sometimes
        // maybe only 2% noise
        baseBrightness *= 0.98 + Math.random() * 0.04;
        // ok! all ready to add this to the value
        if (isLeft) leftSensorValue += baseBrightness;
        else rightSensorValue += baseBrightness;
      }
    };

    // left side
    traceRay(true, 4);
    traceRay(true, 3);
    traceRay(true, 2);
    traceRay(true, 1);
    traceRay(true, 0);
    traceRay(true, -1);
    traceRay(true, -2);
    traceRay(true, -3);
    traceRay(true, -4);
    traceRay(true, -5);
    traceRay(true, -6);
    traceRay(true, -7);
    traceRay(true, -8);
    traceRay(true, -9);
    traceRay(true, -10);

    // right side
    traceRay(false, 10);
    traceRay(false, 9);
    traceRay(false, 8);
    traceRay(false, 7);
    traceRay(false, 6);
    traceRay(false, 5);
    traceRay(false, 4);
    traceRay(false, 3);
    traceRay(false, 2);
    traceRay(false, 1);
    traceRay(false, 0);
    traceRay(false, -1);
    traceRay(false, -2);
    traceRay(false, -3);
    traceRay(false, -4);

    // factor in the offsets
    leftSensorValue *= leftSensorOffset;
    rightSensorValue *= rightSensorOffset;

    // now the brightnesses should be adjusted. float-ize them and cap them
    leftSensorValue = Math.round(leftSensorValue);
    if (leftSensorValue < 0) leftSensorValue = 0;
    if (leftSensorValue > 1023) leftSensorValue = 1023;

    rightSensorValue = Math.round(rightSensorValue);
    if (rightSensorValue < 0) rightSensorValue = 0;
    if (rightSensorValue > 1023) rightSensorValue = 1023;

    // ok, now set the results to the analog pins!
    // 16 = A2 = left sensor
    pinValues[16] = leftSensorValue;
    // 14 = A0 = right sensor
    pinValues[14] = rightSensorValue;
  }

  // - Functions -
  function initGraphics() {
    container = document.getElementById('container');
    speedometer = document.getElementById('speedometer');

    scene = new THREE.Scene();

    camera = new THREE.PerspectiveCamera( 60, container.offsetWidth / container.offsetHeight, 0.2, 2000 );
    camera.position.x = -10;
    camera.position.y = 10;
    camera.position.z = -30;
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
    materialStatic = new THREE.MeshPhongMaterial( { color:0x999999 } );
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
    for (var i = 0; i < syncList.length; i++)
      syncList[i](dt);
    physicsWorld.stepSimulation( dt, 10 );
    //controls.update( dt );
    renderer.render( scene, camera );
    time += dt;
    stats.update();
  };

  function keyup(e) {
    if (this.simPause) return;
    if (e.keyCode == 81) {
      console.log(mainVehicle.getSteeringValue(0), mainVehicle.getSteeringValue(1));
    }
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

    // force *should* be the ratio of power to acceleration.
    // TODO: do this, blah blah blah (desiredLeftSpeed is a power value, not force)
    let leftForce = desiredLeftSpeed;
    let rightForce = desiredRightSpeed;

    mainVehicle.applyEngineForce(leftForce, LEFT_WHEEL);
    mainVehicle.applyEngineForce(rightForce, RIGHT_WHEEL);

    if (leftForce == 0) {
      mainVehicle.setBrake(maxBreakingForce, LEFT_WHEEL);
    }
    if (rightForce == 0) {
      mainVehicle.setBrake(maxBreakingForce, RIGHT_WHEEL);
    }

    var tm, p, q, i;
    var n = mainVehicle.getNumWheels();
    for (i = 0; i < n; i++) {
      mainVehicle.updateWheelTransform(i, true);
      tm = mainVehicle.getWheelTransformWS(i);
      p = tm.getOrigin();
      q = tm.getRotation();
      vehicleWheelMeshes[i].position.set(p.x(), p.y(), p.z());
      vehicleWheelMeshes[i].quaternion.set(q.x(), q.y(), q.z(), q.w());
    }

    tm = mainVehicle.getChassisWorldTransform();
    p = tm.getOrigin();
    q = tm.getRotation();
    vehicleChassisMesh.position.set(p.x(), p.y(), p.z());
    vehicleChassisMesh.quaternion.set(q.x(), q.y(), q.z(), q.w());

    // TODO: lab2-dependent
    lab2_photovore_syncfunc(p, q);
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
      wheelInfo.set_m_frictionSlip(friction);
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
    createBox(new THREE.Vector3(0, -0.5, 0), ZERO_QUATERNION, WORLD_MAX, 1, WORLD_MAX, 0, 1.5);

    //var quaternion = new THREE.Quaternion(0, 0, 0, 1);
    //quaternion.setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 18);
    //createBox(new THREE.Vector3(0, -1.5, 0), quaternion, 8, 4, 10, 0);

    //var size = .75;
    //var nw = 8;
    //var nh = 6;
    //for (var j = 0; j < nw; j++)
    //  for (var i = 0; i < nh; i++)
    //    createBox(new THREE.Vector3(size * j - (size * (nw - 1)) / 2, size * i, 10), ZERO_QUATERNION, size, size, size, 10);

    createVehicle(new THREE.Vector3(0, 1, -20), ZERO_QUATERNION);

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

  document.getElementById('btnRandomizeLightPos').addEventListener('click', function(e) {
      randomizeLightPosn();
      window.location.reload(false);
  });

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


