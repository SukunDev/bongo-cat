#include <Arduino.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <animate.h>

#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
#define OLED_RESET -1
#define SCREEN_ADDRESS 0x3C

Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);
#define I2C_SDA_PIN 6
#define I2C_SCL_PIN 7

int left = 0;
int right = 0;

void scanI2C()
{
  byte error, address;
  int nDevices = 0;

  Serial.println("Scanning for I2C devices...");

  for (address = 1; address < 127; address++)
  {
    Wire.beginTransmission(address);
    error = Wire.endTransmission();

    if (error == 0)
    {
      Serial.print("I2C device found at 0x");
      if (address < 16)
        Serial.print("0");
      Serial.print(address, HEX);

      if (address == 0x3C || address == 0x3D)
      {
        Serial.print(" (SSD1306 OLED)");
      }
      else if (address == 0x68 || address == 0x69)
      {
        Serial.print(" (MPU6050)");
      }
      Serial.println();
      nDevices++;
    }
  }

  if (nDevices == 0)
  {
    Serial.println("No I2C devices found\n");
  }
  else
  {
    Serial.print("Found ");
    Serial.print(nDevices);
    Serial.println(" I2C device(s)\n");
  }
}

void setup()
{
  Serial.begin(115200);
  Serial.println("\n\n=== System Starting ===");

  Wire.begin(I2C_SDA_PIN, I2C_SCL_PIN);
  Wire.setClock(400000);

  Serial.println("I2C initialized on SDA=5, SCL=6");

  Serial.println("Scanning I2C bus...");
  scanI2C();

  Serial.println("\nInitializing OLED...");
  if (!display.begin(SSD1306_SWITCHCAPVCC, SCREEN_ADDRESS))
  {
    Serial.println(F("SSD1306 allocation failed"));
    for (;;)
      ;
  }

  display.clearDisplay();
  display.drawBitmap(0, 0, _pawsonair, 128, 40, 1);
  display.display();

  Serial.println("\n=== System Ready ===\n");
}

void handleSerialInput()
{
  while (Serial.available() > 0)
  {
    char c = Serial.read();
    switch (c)
    {
    case 'L':
      left = HIGH;
      break;
    case 'l':
      left = LOW;
      break;
    case 'R':
      right = HIGH;
      break;
    case 'r':
      right = LOW;
      break;
    default:
      break;
    }
  }
}

void drawFrame()
{
  const unsigned char *frame;
  if (left == HIGH && right == LOW)
    frame = _leftpawontable;
  else if (left == LOW && right == HIGH)
    frame = _rightpawontable;
  else if (left == HIGH && right == HIGH)
    frame = _pawsontable;
  else
    frame = _pawsonair;

  display.clearDisplay();
  display.drawBitmap(0, 0, frame, 128, 40, 1);
  display.display();
}

void loop()
{
  static int lastLeft = -1;
  static int lastRight = -1;

  handleSerialInput();

  if (left != lastLeft || right != lastRight)
  {
    drawFrame();
    lastLeft = left;
    lastRight = right;
  }
}