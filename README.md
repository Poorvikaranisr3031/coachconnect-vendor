# 🚆 CoachConnect — Vendor & Passenger App

**CoachConnect** is a railway travel support web application designed to help passengers discover food stalls serving railway stations and help vendors manage their stall information and available menu items.

The project combines a Vendor App for stall management with a Passenger App for train tracking and stall discovery at the next station.

## ✨ Features

### 🧑‍🍳 Vendor App
- Vendor login using email and password.
- Manage vendor and stall details.
- Configure the coaches served by a stall.
- Add, edit, and manage menu items.
- Update item prices and availability.
- View menu availability information through the vendor dashboard.

### 🚉 Passenger App
- Passenger sign-in and password authentication.
- Location-based verification near railway stations.
- Live train tracking using the RailRadar API.
- View available train information and current train location when returned by the API.
- View the next station when tracking information is available.
- Discover stalls associated with the next station.
- View available menu items provided by registered vendors.

## 🛠️ Technology Stack

| Component | Technology |
|---|---|
| Frontend | HTML, CSS, JavaScript |
| Backend | JavaScript API handlers |
| Database | PostgreSQL |
| Hosting and application platform | Hatchable |
| Live train tracking | RailRadar API |
| Version control | Git and GitHub |

## 🏗️ Project Structure

```text
coachconnect-vendor/
├── api/                  # Backend API handlers
│   ├── public/           # Public API endpoints
│   ├── nearby-railway.js
│   ├── passenger-auth.js
│   ├── train-live.js
│   └── vendor.js
├── lib/                  # Shared authentication utilities
├── migrations/           # Database schema migrations
├── public/
│   ├── passenger/        # Passenger application
│   ├── app.js             # Vendor application logic
│   ├── index.html         # Vendor dashboard entry page
│   ├── login.html         # Vendor login page
│   ├── role-gate.js       # Passenger/vendor role selection
│   └── style.css          # Vendor interface styles
├── hatchable.toml        # Hatchable configuration
└── README.md             # Project documentation
```

## 🔄 How It Works

1. **Choose a role:** Users select the Passenger App or Vendor App.
2. **Vendor management:** Vendors sign in and maintain their stall information, coach coverage, menu items, prices, and availability.
3. **Passenger access:** Passengers sign in and complete the configured railway-station location verification.
4. **Train tracking:** Passengers enter a train number and journey date to request live train information.
5. **Next-station discovery:** When tracking information is available, the application displays the next station and identifies registered stalls associated with that station.
6. **Menu discovery:** Passengers can view available menu items supplied by the registered vendors.

## 🖼️ Screenshots

Add screenshots of the actual application in the `screenshots/` directory and update the image paths below.

### 1. Role Selection

![CoachConnect Role Selection](screenshots/role-selection.png)

### 2. Vendor Dashboard

![CoachConnect Vendor Dashboard](screenshots/vendor-dashboard.png)

### 3. Vendor Menu Management

![CoachConnect Menu Management](screenshots/vendor-menu.png)

### 4. Passenger Login

![CoachConnect Passenger Login](screenshots/passenger-login.png)

### 5. Live Train Tracking

![CoachConnect Live Train Tracking](screenshots/train-tracking.png)

### 6. Next-Station Stall Discovery

![CoachConnect Next-Station Stall Discovery](screenshots/next-station-stalls.png)

> **Note:** These are screenshot placeholders. Add the corresponding image files before expecting the screenshots to display.

## ⚙️ Configuration

The application uses Hatchable for hosting and PostgreSQL for data storage. Live train tracking uses the RailRadar API.

Before deploying or running the application in a compatible environment:

1. Configure the PostgreSQL database connection using the hosting platform's supported environment settings.
2. Configure the required RailRadar API key as a secret environment variable named `RAILRADAR_API_KEY`.
3. Apply the database migrations in the order required by the project.
4. Configure any additional authentication or hosting settings required by the application.
5. Deploy the project and verify the vendor login, passenger login, menu management, and train-tracking workflows.

**Security:** Never commit API keys, database passwords, or other private credentials to GitHub.

## 🚀 Live Application

- **Hosted application:** [CoachConnect Vendor App](https://coachconnect-vendor.hatchable.site)
- **Vendor login:** [Open Vendor Login](https://coachconnect-vendor.hatchable.site/login)
- **Passenger login:** [Open Passenger Login](https://coachconnect-vendor.hatchable.site/passenger/login)
- **GitHub repository:** [coachconnect-vendor](https://github.com/Poorvikaranisr3031/coachconnect-vendor)

## 🔮 Future Scope

Potential improvements include:

- More detailed stall-to-coach location mapping.
- Improved stall discovery using train and station information.
- Enhanced live train tracking and error handling.
- Additional railway stations and vendor coverage.
- A more detailed passenger interface for discovering nearby or upcoming food stalls.

These are proposed enhancements and are not necessarily implemented in the current version.

## 🤝 Contributing

Contributions and suggestions are welcome.

1. Fork the repository.
2. Create a feature branch.
3. Make and test your changes.
4. Submit a pull request describing your improvements.

## 📄 License

No license has been specified for this repository yet. Add an appropriate `LICENSE` file before granting others permission to reuse, modify, or distribute the project.

---

**CoachConnect — Connecting Railway Passengers with Station Food Stalls.**
