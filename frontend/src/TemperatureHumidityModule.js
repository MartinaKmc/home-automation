import React, { useState, useEffect } from "react";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  TimeScale,
} from "chart.js";
import { CircularProgressbar, buildStyles } from "react-circular-progressbar";
import "react-circular-progressbar/dist/styles.css";
import "chartjs-adapter-date-fns";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  TimeScale
);

const TemperatureHumidityModule = () => {
  const [temperature, setTemperature] = useState(22.4);
  const [humidity, setHumidity] = useState(45);
  const [temperatureHistory, setTemperatureHistory] = useState([]);
  const [humidityHistory, setHumidityHistory] = useState([]);

  // Fetch the historical data on component mount
  useEffect(() => {
    const fetchHistoricalData = async () => {
      try {
        const response = await fetch("http://<broker_address>:5000/history");
        const data = await response.json();

        // Convert timestamps to Date objects and map data for the chart
        const tempHistory = data.map((item) => ({
          x: new Date(item.timestamp * 1000),
          y: parseFloat(item.temperature).toFixed(1),
        }));

        const humHistory = data.map((item) => ({
          x: new Date(item.timestamp * 1000),
          y: parseFloat(item.humidity).toFixed(1),
        }));

        // Set historical data
        setTemperatureHistory(tempHistory.reverse());
        setHumidityHistory(humHistory.reverse());
      } catch (error) {
        console.error("Error fetching historical data:", error);
      }
    };

    fetchHistoricalData();
  }, []);

  // Fetch latest temperature and humidity data every 15 minutes
  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch("http://<broker_address>:5000/latest");
        const data = await response.json();

        let { temperature, humidity, timestamp } = data;

        // Convert timestamp to Date object
        const formattedTimestamp = new Date(timestamp * 1000);

        // Round temperature and humidity values
        temperature = parseFloat(temperature).toFixed(1);
        humidity = parseFloat(humidity).toFixed(1);

        // Update state with latest readings
        setTemperature(temperature);
        setHumidity(humidity);

        // Append the new data to the historical array
        setTemperatureHistory((prev) =>
          [...prev, { x: formattedTimestamp, y: temperature }].slice(-100)
        );
        setHumidityHistory((prev) =>
          [...prev, { x: formattedTimestamp, y: humidity }].slice(-100)
        );
      } catch (error) {
        console.error("Error fetching data:", error);
      }
    };

    const interval = setInterval(fetchData, 900000); // Fetch data every 15 minutes
    return () => clearInterval(interval); // Cleanup the interval on component unmount
  }, []);

  const getTemperatureColor = (temp) => {
    if (temp < 18) return "blue";
    if (temp > 28) return "red";
    return "green";
  };

  const getHumidityColor = (hum) => {
    if (hum < 30) return "blue";
    if (hum > 60) return "red";
    return "green";
  };

  const commonOptions = {
    scales: {
      x: {
        type: "time", // Time scale for the x-axis
        time: {
          unit: "day", // Display as days; adjust this based on the density of your data
          tooltipFormat: "PPpp", // Format the tooltip to show date and time
        },
        grid: {
          display: false, // Hide gridlines
        },
      },
      y: {
        grid: {
          display: false, // Hide gridlines
        },
      },
    },
    responsive: true,
    maintainAspectRatio: false, // Prevent stretching
  };

  const temperatureData = {
    datasets: [
      {
        label: "Temperature (°C)",
        data: temperatureHistory,
        borderColor: "rgba(255, 99, 132, 1)",
        backgroundColor: "rgba(255, 99, 132, 0.2)",
        tension: 0.1,
      },
    ],
  };

  const humidityData = {
    datasets: [
      {
        label: "Humidity (%)",
        data: humidityHistory,
        borderColor: "rgba(54, 162, 235, 1)",
        backgroundColor: "rgba(54, 162, 235, 0.2)",
        tension: 0.1,
      },
    ],
  };

  return (
    <div>
      <h2>Temperature & Humidity</h2>
      <div
        style={{
          display: "flex",
          justifyContent: "space-around",
          marginBottom: "20px",
        }}
      >
        {/* Temperature Circular Progress Bar */}
        <div style={{ width: 100, height: 100 }}>
          <CircularProgressbar
            value={temperature}
            maxValue={40}
            text={`${temperature}°C`}
            styles={buildStyles({
              pathColor: getTemperatureColor(temperature),
              textColor: "#333",
              trailColor: "#eee",
              strokeLinecap: "round",
            })}
          />
        </div>

        {/* Humidity Circular Progress Bar */}
        <div style={{ width: 100, height: 100 }}>
          <CircularProgressbar
            value={humidity}
            maxValue={100}
            text={`${humidity}%`}
            styles={buildStyles({
              pathColor: getHumidityColor(humidity),
              textColor: "#333",
              trailColor: "#eee",
              strokeLinecap: "round",
            })}
          />
        </div>
      </div>

      <div
        style={{ display: "flex", justifyContent: "space-around", gap: "20px" }}
      >
        <div style={{ width: "45%", height: "300px" }}>
          <h4>Temperature History</h4>
          <Line data={temperatureData} options={commonOptions} />
        </div>

        <div style={{ width: "45%", height: "300px" }}>
          <h4>Humidity History</h4>
          <Line data={humidityData} options={commonOptions} />
        </div>
      </div>
    </div>
  );
};

export default TemperatureHumidityModule;
