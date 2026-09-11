package com.beardrive.formosa;

import android.Manifest;
import android.app.Activity;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.location.Location;
import android.os.Bundle;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;

import androidx.core.content.ContextCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.gms.maps.GoogleMap;
import com.google.android.gms.maps.model.LatLng;
import com.google.android.libraries.navigation.ListenableResultFuture;
import com.google.android.libraries.navigation.NavigationApi;
import com.google.android.libraries.navigation.NavigationView;
import com.google.android.libraries.navigation.Navigator;
import com.google.android.libraries.navigation.RoadSnappedLocationProvider;
import com.google.android.libraries.navigation.RouteSegment;
import com.google.android.libraries.navigation.TimeAndDistance;
import com.google.android.libraries.navigation.Waypoint;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.List;

@CapacitorPlugin(name = "BearDriveNavigation")
public class BearDriveNavigationPlugin extends Plugin {

    private static final int NAVY = Color.rgb(24, 30, 47);
    private static final int NAVY_SOFT = Color.rgb(32, 40, 60);
    private static final int GOLD = Color.rgb(233, 183, 78);
    private static final int WHITE = Color.WHITE;

    private FrameLayout overlayRoot;
    private NavigationView navigationView;
    private LinearLayout tripCard;
    private LinearLayout tripDetails;
    private TextView tripTitle;
    private TextView tripSubtitle;
    private TextView tripChevron;

    private Navigator navigator;
    private RoadSnappedLocationProvider roadSnappedLocationProvider;

    private Navigator.ArrivalListener arrivalListener;
    private Navigator.RemainingTimeOrDistanceChangedListener progressListener;
    private Navigator.RouteChangedListener routeChangedListener;
    private RoadSnappedLocationProvider.LocationListener locationListener;

    private String rideId;
    private String phase;
    private boolean overlayStarted = false;
    private boolean cardExpanded = false;

    @PluginMethod
    public void startNavigation(PluginCall call) {
        Double latitude = call.getDouble("latitude");
        Double longitude = call.getDouble("longitude");
        String nextRideId = call.getString("rideId");
        String nextPhase = call.getString("phase");

        if (latitude == null || longitude == null || nextRideId == null || nextPhase == null) {
            call.reject("Faltan coordenadas, rideId o phase para iniciar navegación.");
            return;
        }

        Activity activity = getActivity();
        if (activity == null || activity.isFinishing() || activity.isDestroyed()) {
            call.reject("La actividad Android no está disponible.");
            return;
        }

        if (ContextCompat.checkSelfPermission(activity, Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
            call.reject("BearDrive necesita ubicación precisa antes de iniciar navegación.");
            return;
        }

        rideId = nextRideId;
        phase = nextPhase;
        String targetTitle = safe(call.getString("targetTitle"), "Destino");
        String passengerName = safe(call.getString("passengerName"), "Pasajero");
        String pickupAddress = safe(call.getString("pickupAddress"), "");
        String destinationAddress = safe(call.getString("destinationAddress"), "");
        String fareLabel = safe(call.getString("fareLabel"), "");

        activity.runOnUiThread(() -> {
            try {
                ensureOverlay(activity, passengerName, pickupAddress, destinationAddress, fareLabel, targetTitle);
                initializeNavigator(activity, latitude, longitude, targetTitle, call);
            } catch (Exception error) {
                emitError("native_navigation_start_failed", error.getMessage());
                call.reject("No se pudo iniciar Google Navigation.", error);
            }
        });
    }

    @PluginMethod
    public void stopNavigation(PluginCall call) {
        Activity activity = getActivity();
        if (activity == null) {
            call.resolve();
            return;
        }
        activity.runOnUiThread(() -> {
            stopNavigationInternal(true);
            call.resolve();
        });
    }

    @PluginMethod
    public void recenter(PluginCall call) {
        Activity activity = getActivity();
        if (activity == null || navigationView == null) {
            call.resolve();
            return;
        }

        activity.runOnUiThread(() -> {
            try {
                navigationView.getMapAsync(map -> map.followMyLocation(GoogleMap.CameraPerspective.TILTED));
            } catch (Exception ignored) {
                // NavigationView's own recenter button remains available as fallback.
            }
            call.resolve();
        });
    }

    private void ensureOverlay(
        Activity activity,
        String passengerName,
        String pickupAddress,
        String destinationAddress,
        String fareLabel,
        String targetTitle
    ) {
        if (overlayRoot != null) {
            updateTripCard(passengerName, pickupAddress, destinationAddress, fareLabel, targetTitle);
            setCardExpanded(false);
            return;
        }

        overlayRoot = new FrameLayout(activity);
        overlayRoot.setBackgroundColor(Color.BLACK);
        overlayRoot.setClickable(true);
        overlayRoot.setFocusable(true);

        navigationView = new NavigationView(activity);
        navigationView.setNavigationUiEnabled(true);
        navigationView.setHeaderEnabled(true);
        navigationView.setEtaCardEnabled(true);
        navigationView.setRecenterButtonEnabled(true);

        FrameLayout.LayoutParams navParams = new FrameLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.MATCH_PARENT
        );
        overlayRoot.addView(navigationView, navParams);

        tripCard = new LinearLayout(activity);
        tripCard.setOrientation(LinearLayout.VERTICAL);
        tripCard.setPadding(dp(16), dp(12), dp(16), dp(12));
        tripCard.setBackground(roundedBackground(NAVY, 20));
        tripCard.setElevation(dp(12));

        LinearLayout summaryRow = new LinearLayout(activity);
        summaryRow.setOrientation(LinearLayout.HORIZONTAL);
        summaryRow.setGravity(Gravity.CENTER_VERTICAL);

        LinearLayout summaryText = new LinearLayout(activity);
        summaryText.setOrientation(LinearLayout.VERTICAL);
        summaryText.setLayoutParams(new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f));

        tripTitle = text(activity, passengerName, 16, WHITE, Typeface.BOLD);
        tripSubtitle = text(activity, targetTitle, 12, GOLD, Typeface.BOLD);
        summaryText.addView(tripTitle);
        summaryText.addView(tripSubtitle);

        tripChevron = text(activity, "▲", 16, GOLD, Typeface.BOLD);
        tripChevron.setPadding(dp(12), dp(6), dp(4), dp(6));

        summaryRow.addView(summaryText);
        summaryRow.addView(tripChevron);
        tripCard.addView(summaryRow);

        tripDetails = new LinearLayout(activity);
        tripDetails.setOrientation(LinearLayout.VERTICAL);
        tripDetails.setPadding(0, dp(10), 0, 0);
        tripCard.addView(tripDetails);

        tripCard.setOnClickListener(view -> setCardExpanded(!cardExpanded));

        FrameLayout.LayoutParams cardParams = new FrameLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.WRAP_CONTENT,
            Gravity.BOTTOM
        );
        int margin = dp(12);
        cardParams.setMargins(margin, margin, margin, margin + dp(8));
        overlayRoot.addView(tripCard, cardParams);

        updateTripCard(passengerName, pickupAddress, destinationAddress, fareLabel, targetTitle);
        setCardExpanded(false);

        activity.addContentView(
            overlayRoot,
            new ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT)
        );

        navigationView.onCreate((Bundle) null);
        navigationView.onStart();
        navigationView.onResume();
        overlayStarted = true;
    }

    private void updateTripCard(
        String passengerName,
        String pickupAddress,
        String destinationAddress,
        String fareLabel,
        String targetTitle
    ) {
        if (tripTitle == null || tripSubtitle == null || tripDetails == null) return;

        tripTitle.setText(passengerName);
        tripSubtitle.setText(("pickup".equals(phase) ? "Ir a buscar · " : "En viaje · ") + targetTitle);
        tripDetails.removeAllViews();

        if (!pickupAddress.isEmpty()) {
            tripDetails.addView(detailLine("Recogida", pickupAddress));
        }
        if (!destinationAddress.isEmpty()) {
            tripDetails.addView(detailLine("Destino", destinationAddress));
        }
        if (!fareLabel.isEmpty()) {
            tripDetails.addView(detailLine("Tarifa", fareLabel));
        }
    }

    private View detailLine(String label, String value) {
        Activity activity = getActivity();
        LinearLayout row = new LinearLayout(activity);
        row.setOrientation(LinearLayout.VERTICAL);
        row.setPadding(0, dp(4), 0, dp(4));
        row.addView(text(activity, label.toUpperCase(), 10, Color.rgb(174, 182, 199), Typeface.BOLD));
        row.addView(text(activity, value, 13, WHITE, Typeface.NORMAL));
        return row;
    }

    private void setCardExpanded(boolean expanded) {
        cardExpanded = expanded;
        if (tripDetails != null) tripDetails.setVisibility(expanded ? View.VISIBLE : View.GONE);
        if (tripChevron != null) tripChevron.setText(expanded ? "▼" : "▲");

        if (navigationView != null) {
            int bottomPadding = expanded ? dp(220) : dp(92);
            navigationView.getMapAsync(map -> map.setPadding(0, 0, 0, bottomPadding));
        }
    }

    private void initializeNavigator(
        Activity activity,
        double latitude,
        double longitude,
        String targetTitle,
        PluginCall call
    ) {
        NavigationApi.getNavigator(activity, new NavigationApi.NavigatorListener() {
            @Override
            public void onNavigatorReady(Navigator readyNavigator) {
                if (activity.isFinishing() || activity.isDestroyed()) {
                    call.reject("Android cerró la actividad antes de iniciar navegación.");
                    return;
                }

                navigator = readyNavigator;
                configureNavigatorListeners();
                configureRoadSnappedLocation();

                navigationView.setNavigationUiEnabled(true);
                navigationView.getMapAsync(map -> {
                    map.setTrafficEnabled(true);
                    map.followMyLocation(GoogleMap.CameraPerspective.TILTED);
                });

                Waypoint waypoint = Waypoint.builder()
                    .setLatLng(latitude, longitude)
                    .setTitle(targetTitle)
                    .setVehicleStopover(true)
                    .build();

                ListenableResultFuture<Navigator.RouteStatus> routeFuture = navigator.setDestination(waypoint);
                routeFuture.setOnResultListener(routeStatus -> {
                    if (routeStatus == Navigator.RouteStatus.OK) {
                        navigator.setHeadsUpNotificationEnabled(true);
                        navigator.startGuidance();
                        emitRouteChanged();
                        emitProgress();

                        JSObject result = new JSObject();
                        result.put("started", true);
                        result.put("rideId", rideId);
                        result.put("phase", phase);
                        call.resolve(result);
                    } else {
                        JSObject error = new JSObject();
                        error.put("code", "route_unavailable");
                        error.put("routeStatus", routeStatus.name());
                        error.put("rideId", rideId);
                        error.put("phase", phase);
                        notifyListeners("navigationError", error);
                        call.reject("Google Navigation no pudo calcular la ruta: " + routeStatus.name());
                    }
                });
            }

            @Override
            public void onError(int errorCode) {
                JSObject error = new JSObject();
                error.put("code", "navigator_init_failed");
                error.put("errorCode", errorCode);
                error.put("rideId", rideId);
                error.put("phase", phase);
                notifyListeners("navigationError", error);
                call.reject("No se pudo inicializar Google Navigation. Código: " + errorCode);
            }
        });
    }

    private void configureNavigatorListeners() {
        removeNavigatorListeners();
        if (navigator == null) return;

        arrivalListener = event -> {
            JSObject data = baseEvent();
            notifyListeners("arrival", data);
            stopNavigationInternal(false);
        };

        progressListener = this::emitProgress;
        routeChangedListener = this::emitRouteChanged;

        navigator.addArrivalListener(arrivalListener);
        navigator.addRemainingTimeOrDistanceChangedListener(5, 25, progressListener);
        navigator.addRouteChangedListener(routeChangedListener);
    }

    private void configureRoadSnappedLocation() {
        removeLocationListener();
        Activity activity = getActivity();
        if (activity == null) return;

        roadSnappedLocationProvider = NavigationApi.getRoadSnappedLocationProvider(activity.getApplication());
        locationListener = new RoadSnappedLocationProvider.LocationListener() {
            @Override
            public void onLocationChanged(Location location) {
                emitLocation(location);
            }

            @Override
            public void onRawLocationUpdate(Location location) {
                // Road-snapped positions are preferred. Raw fixes are intentionally not
                // published unless the SDK cannot produce snapped fixes in future handling.
            }
        };
        roadSnappedLocationProvider.addLocationListener(locationListener);
    }

    private void emitLocation(Location location) {
        if (location == null) return;
        JSObject data = baseEvent();
        data.put("latitude", location.getLatitude());
        data.put("longitude", location.getLongitude());
        data.put("bearing", location.hasBearing() ? location.getBearing() : JSONObject.NULL);
        data.put("speed", location.hasSpeed() ? location.getSpeed() : JSONObject.NULL);
        data.put("accuracy", location.hasAccuracy() ? location.getAccuracy() : JSONObject.NULL);
        data.put("timestamp", location.getTime());
        boolean snapped = location.getExtras() != null &&
            location.getExtras().getBoolean(RoadSnappedLocationProvider.LocationListener.IS_ROAD_SNAPPED_KEY, false);
        data.put("roadSnapped", snapped);
        notifyListeners("location", data);
    }

    private void emitProgress() {
        if (navigator == null) return;
        TimeAndDistance value = navigator.getCurrentTimeAndDistance();
        if (value == null) return;

        JSObject data = baseEvent();
        data.put("etaSeconds", value.getSeconds());
        data.put("distanceMeters", value.getMeters());
        data.put("delaySeverity", value.getDelaySeverity());
        notifyListeners("progress", data);

        if (tripSubtitle != null) {
            int minutes = Math.max(1, (int) Math.ceil(value.getSeconds() / 60.0));
            String distance = value.getMeters() < 1000
                ? Math.max(10, Math.round(value.getMeters() / 10f) * 10) + " m"
                : String.format(java.util.Locale.US, "%.1f km", value.getMeters() / 1000.0);
            tripSubtitle.setText(("pickup".equals(phase) ? "Ir a buscar · " : "En viaje · ") + minutes + " min · " + distance);
        }
    }

    private void emitRouteChanged() {
        if (navigator == null) return;
        JSObject data = baseEvent();
        JSONArray points = new JSONArray();

        try {
            List<RouteSegment> segments = navigator.getRouteSegments();
            if (segments != null) {
                for (RouteSegment segment : segments) {
                    List<LatLng> latLngs = segment.getLatLngs();
                    if (latLngs == null) continue;
                    for (LatLng point : latLngs) {
                        JSONObject jsonPoint = new JSONObject();
                        jsonPoint.put("lat", point.latitude);
                        jsonPoint.put("lng", point.longitude);
                        points.put(jsonPoint);
                    }
                }
            }
        } catch (Exception ignored) {
            // routeChanged still informs JS even if polyline serialization fails.
        }

        data.put("routePolyline", points.toString());
        notifyListeners("routeChanged", data);
        emitProgress();
    }

    private JSObject baseEvent() {
        JSObject data = new JSObject();
        data.put("rideId", rideId);
        data.put("phase", phase);
        return data;
    }

    private void emitError(String code, String message) {
        JSObject error = baseEvent();
        error.put("code", code);
        error.put("message", message == null ? "Error de navegación" : message);
        notifyListeners("navigationError", error);
    }

    private void stopNavigationInternal(boolean emitClosed) {
        removeNavigatorListeners();
        removeLocationListener();

        if (navigator != null) {
            try {
                navigator.stopGuidance();
                navigator.clearDestinations();
            } catch (Exception ignored) {}
        }

        if (navigationView != null) {
            try {
                if (overlayStarted) {
                    navigationView.onPause();
                    navigationView.onStop();
                }
                navigationView.onDestroy();
            } catch (Exception ignored) {}
        }
        overlayStarted = false;

        if (overlayRoot != null) {
            ViewGroup parent = (ViewGroup) overlayRoot.getParent();
            if (parent != null) parent.removeView(overlayRoot);
        }

        overlayRoot = null;
        navigationView = null;
        tripCard = null;
        tripDetails = null;
        tripTitle = null;
        tripSubtitle = null;
        tripChevron = null;
        cardExpanded = false;

        if (emitClosed) {
            notifyListeners("navigationClosed", baseEvent());
        }
    }

    private void removeNavigatorListeners() {
        if (navigator == null) return;
        try {
            if (arrivalListener != null) navigator.removeArrivalListener(arrivalListener);
            if (progressListener != null) navigator.removeRemainingTimeOrDistanceChangedListener(progressListener);
            if (routeChangedListener != null) navigator.removeRouteChangedListener(routeChangedListener);
        } catch (Exception ignored) {}
        arrivalListener = null;
        progressListener = null;
        routeChangedListener = null;
    }

    private void removeLocationListener() {
        if (roadSnappedLocationProvider != null && locationListener != null) {
            try {
                roadSnappedLocationProvider.removeLocationListener(locationListener);
            } catch (Exception ignored) {}
        }
        locationListener = null;
        roadSnappedLocationProvider = null;
    }

    @Override
    protected void handleOnStart() {
        super.handleOnStart();
        if (navigationView != null && !overlayStarted) {
            navigationView.onStart();
            overlayStarted = true;
        }
    }

    @Override
    protected void handleOnResume() {
        super.handleOnResume();
        if (navigationView != null) navigationView.onResume();
    }

    @Override
    protected void handleOnPause() {
        if (navigationView != null) navigationView.onPause();
        super.handleOnPause();
    }

    @Override
    protected void handleOnStop() {
        if (navigationView != null && overlayStarted) {
            navigationView.onStop();
            overlayStarted = false;
        }
        super.handleOnStop();
    }

    @Override
    protected void handleOnDestroy() {
        Activity activity = getActivity();
        if (activity != null) {
            activity.runOnUiThread(() -> {
                stopNavigationInternal(false);
                if (navigator != null) {
                    try {
                        navigator.cleanup();
                    } catch (Exception ignored) {}
                    navigator = null;
                }
            });
        }
        super.handleOnDestroy();
    }

    private TextView text(Activity activity, String value, float sizeSp, int color, int style) {
        TextView view = new TextView(activity);
        view.setText(value);
        view.setTextSize(sizeSp);
        view.setTextColor(color);
        view.setTypeface(Typeface.DEFAULT, style);
        return view;
    }

    private GradientDrawable roundedBackground(int color, int radiusDp) {
        GradientDrawable drawable = new GradientDrawable();
        drawable.setColor(color);
        drawable.setCornerRadius(dp(radiusDp));
        drawable.setStroke(dp(1), NAVY_SOFT);
        return drawable;
    }

    private int dp(int value) {
        return Math.round(value * getContext().getResources().getDisplayMetrics().density);
    }

    private String safe(String value, String fallback) {
        return value == null || value.trim().isEmpty() ? fallback : value.trim();
    }
}
