#include <WiFi.h>
#include <PubSubClient.h>
#include "DHT.h"
#include <NTPClient.h>
#include <ArduinoJson.h>  // Include ArduinoJson library

#define DHTPIN 14 // Digital pin connected to the DHT sensor
#define DHTTYPE DHT22 // Sensor type

// Initialize DHT sensor.
DHT dht(DHTPIN, DHTTYPE);

const char *ssid = ""; 
const char *password = "";  

WiFiUDP ntpUDP;
NTPClient timeClient(ntpUDP, "pool.ntp.org", 0, 60000);  // NTP server pool, 0 offset (UTC), update every 60 seconds



// MQTT Broker
const char *mqtt_broker = "";
const char *topic = "dht22";
const int mqtt_port = 1883;

WiFiClient espClient;
PubSubClient client(espClient);

void setup() {
  Serial.begin(115200);
  dht.begin();
  // connecting to a WiFi network
  setup_wifi();
  //connecting to a mqtt broker
  client.setServer(mqtt_broker, mqtt_port);

  timeClient.begin();
}

void setup_wifi() {
  delay(10);
  Serial.println();
  Serial.print("Connecting to ");
  Serial.println(ssid);

  WiFi.begin(ssid, password);

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println("");
  Serial.println("WiFi connected");
  Serial.println("IP address: ");
  Serial.println(WiFi.localIP());
}

void reconnect() {
  while (!client.connected()) {
     String client_id = "esp32-client-";
     client_id += String(WiFi.macAddress());
     Serial.printf("The client %s connects to mqtt broker\n", client_id.c_str());
     if (client.connect(client_id.c_str())) {
         Serial.println("Connected to MQTT broker");
     } else {
         Serial.print("Failed with state ");
         Serial.print(client.state());
         delay(2000);
     }
 }
}


void loop() {
  delay(900000); // wait for 15 minutes
  timeClient.update();
  if (!client.connected()) {
    reconnect();
  }

  client.loop();

  float humidity = dht.readHumidity();
  float temperature = dht.readTemperature();

  if (isnan(humidity) || isnan(temperature)) {      
    Serial.println("Error while reading data!");
    return;
  }
  float heatIndex = dht.computeHeatIndex(temperature, humidity, false);

  StaticJsonDocument<200> doc;
  doc["temperature"] = temperature;
  doc["humidity"] = humidity;
  doc["heatIndex"] = heatIndex;

   // Get the current timestamp
  unsigned long timestamp = timeClient.getEpochTime();
  doc["timestamp"] = timestamp;

  // Serialize JSON to string
  char jsonBuffer[200];
  serializeJson(doc, jsonBuffer);

  // Publish JSON
  client.publish(topic, jsonBuffer);

  // Output to Serial for debugging
  Serial.println(jsonBuffer);
}
