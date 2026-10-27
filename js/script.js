/**
 * DriveLedger — Official Landing Page JavaScript
 * Version: 1.0.2
 */

(function () {
  "use strict";

  const GITHUB_REPO = "Harshit-code-tech/DriveLedger";
  const DEFAULT_VERSION = "v0.1.0";

  // ─── Vehicle Demo Data for Receipt Card ───
  const VEHICLE_PROFILES = [
    {
      name: "Honda City",
      type: "🚗",
      mileage: "16.4",
      avg: "15.8",
      odometer: "34,250",
      monthSpend: "₹4,820",
      frontPsi: 32,
      rearPsi: 30,
    },
    {
      name: "Royal Enfield 350",
      type: "🏍️",
      mileage: "36.2",
      avg: "35.4",
      odometer: "8,920",
      monthSpend: "₹1,950",
      frontPsi: 22,
      rearPsi: 32,
    },
    {
      name: "Honda Activa 6G",
      type: "🛵",
      mileage: "47.8",
      avg: "46.5",
      odometer: "12,400",
      monthSpend: "₹1,240",
      frontPsi: 22,
      rearPsi: 29,
    },
  ];

  let currentVehicleIndex = 0;

  // ─── DOM Elements ───
  document.addEventListener("DOMContentLoaded", () => {
    initNavbarScroll();
    initVehicleSwitcher();
    initCopyToClipboard();
    fetchLatestRelease();
  });

  /**
   * Add background shadow on scroll to fixed navbar
   */
  function initNavbarScroll() {
    const nav = document.querySelector("nav");
    if (!nav) return;

    window.addEventListener(
      "scroll",
      () => {
        if (window.scrollY > 20) {
          nav.classList.add("scrolled");
        } else {
          nav.classList.remove("scrolled");
        }
      },
      { passive: true },
    );
  }

  /**
   * Interactive vehicle switcher when user clicks the vehicle chip in hero card
   */
  function initVehicleSwitcher() {
    const chip = document.getElementById("vehicleChip");
    if (!chip) return;

    chip.addEventListener("click", () => {
      currentVehicleIndex = (currentVehicleIndex + 1) % VEHICLE_PROFILES.length;
      const v = VEHICLE_PROFILES[currentVehicleIndex];

      chip.textContent = `${v.type} ${v.name} ▾`;

      const mileageVal = document.getElementById("statMileage");
      const avgVal = document.getElementById("statAvg");
      const odoVal = document.getElementById("statOdometer");
      const spendVal = document.getElementById("statSpend");
      const tyreVals = document.getElementById("statTyres");

      if (mileageVal)
        mileageVal.innerHTML = `${v.mileage} <span style="font-size:18px; opacity:0.7;">km/L</span>`;
      if (avgVal) avgVal.textContent = `⚡ Running avg: ${v.avg} km/L`;
      if (odoVal) odoVal.textContent = `${v.odometer} km`;
      if (spendVal) spendVal.textContent = v.monthSpend;
      if (tyreVals)
        tyreVals.innerHTML = `Front: ${v.frontPsi} &nbsp;·&nbsp; Rear: ${v.rearPsi}`;

      // Micro animation trigger
      chip.style.transform = "scale(0.95)";
      setTimeout(() => {
        chip.style.transform = "";
      }, 150);
    });
  }

  /**
   * Copy API snippet or repository URL on click
   */
  function initCopyToClipboard() {
    const cmdBlocks = document.querySelectorAll(".cmd-block");
    cmdBlocks.forEach((block) => {
      block.setAttribute("title", "Click to copy");
      block.addEventListener("click", () => {
        const textToCopy = block.innerText.replace(/\s+/g, " ").trim();
        navigator.clipboard
          ?.writeText(textToCopy)
          .then(() => {
            showToast("Copied to clipboard! 📋");
          })
          .catch(() => {
            showToast("Selected command text 📋");
          });
      });
    });
  }

  /**
   * Toast notification helper
   */
  function showToast(msg) {
    let toast = document.getElementById("toastNotification");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "toastNotification";
      toast.className = "toast";
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.classList.add("show");
    setTimeout(() => {
      toast.classList.remove("show");
    }, 2400);
  }

  /**
   * Dynamically query GitHub API to check latest release tag and APK asset link
   */
  async function fetchLatestRelease() {
    try {
      const response = await fetch(
        `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`,
      );
      if (!response.ok) return;

      const data = await response.json();
      const tagName = data.tag_name || DEFAULT_VERSION;

      // Update version tags in DOM
      document.querySelectorAll(".app-version-badge").forEach((el) => {
        el.textContent = `${tagName} · Free & Open Source`;
      });

      // Look for APK download URL
      const apkAsset = data.assets?.find(
        (a) => a.name && a.name.toLowerCase().endsWith(".apk"),
      );

      if (apkAsset && apkAsset.browser_download_url) {
        document.querySelectorAll(".download-apk-btn").forEach((btn) => {
          btn.href = apkAsset.browser_download_url;
          btn.innerHTML = `📲 Download ${tagName} APK`;
        });
      }

      // Update terminal visual version preview
      const termTag = document.getElementById("terminalVersionTag");
      if (termTag) {
        termTag.textContent = `"${tagName}"`;
      }
      const termStatus = document.getElementById("terminalStatusBadge");
      if (termStatus) {
        termStatus.textContent = `✓ Latest Release (${tagName})`;
      }
    } catch (e) {
      // Offline or rate-limited: graceful silent fallback to static values
      console.log("Using static release info:", e);
    }
  }
})();
