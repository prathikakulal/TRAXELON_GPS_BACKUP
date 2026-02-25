// src/App.jsx
import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import Navbar from "./components/Navbar";
import ProtectedRoute from "./components/ProtectedRoute";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Dashboard from "./pages/Dashboard";
import About from "./pages/About";
import Contact from "./pages/Contact";
import TrackingCapture from "./pages/TrackingCapture";
import LocationTracker from "./components/LocationTracker";

export default function App() {
  return (
    <Router>
      <AuthProvider>
        <Routes>
          {/* Tracking link — no navbar */}
          <Route path="/t/:token" element={<TrackingCapture />} />

          {/* Location page — full-screen, no navbar */}
          <Route
            path="/location"
            element={
              <ProtectedRoute>
                <LocationTracker />
              </ProtectedRoute>
            }
          />

          {/* All other routes — with Navbar */}
          <Route
            path="*"
            element={
              <div className="min-h-screen bg-surface">
                <Navbar />
                <Routes>
                  <Route path="/" element={<Home />} />
                  <Route path="/login" element={<Login />} />
                  <Route path="/signup" element={<Signup />} />
                  <Route path="/about" element={<About />} />
                  <Route path="/contact" element={<Contact />} />
                  <Route
                    path="/dashboard"
                    element={
                      <ProtectedRoute>
                        <Dashboard />
                      </ProtectedRoute>
                    }
                  />
                </Routes>
              </div>
            }
          />
        </Routes>
      </AuthProvider>
    </Router>
  );
}
