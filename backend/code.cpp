// CS10 / C510
#include <Romi32U4.h>

Romi32U4Motors motors;
Romi32U4ButtonA buttonA;
Romi32U4ButtonB buttonB;
Romi32U4ButtonC buttonC;

// Run once, when the sketch starts
void setup() {
  ledRed(true);
  while (!buttonA.isPressed()) {
    delay(100);
  }
  ledRed(false);

  motors.setLeftSpeed(-100);
  motors.setRightSpeed(100);
  Serial.begin(9600);
  Serial.println("it works!");
}

int i = 0, leftSpeed = 400;

void loop() {
  // delay(1000);
  // if (i % 10 == 1) {
  //   motors.allowTurbo(true);
  //   ledGreen(true);
  //   ledYellow(false);
  // }
  // else if (i % 10 == 6) {
  //   motors.allowTurbo(false);
  //   ledGreen(false);
  //   ledYellow(true);
  // }
  if (buttonB.isPressed()) {
    leftSpeed = 0;
    Serial.print("DECR leftSpeed to ");
    Serial.println(leftSpeed);
  } else if (buttonC.isPressed()) {
    leftSpeed += 150;
    Serial.print("INCR leftSpeed to ");
    Serial.println(leftSpeed);
  }
  motors.setSpeeds(leftSpeed, leftSpeed);
  delay(400);
  // motors.setLeftSpeed(100);
  // i++;
}
