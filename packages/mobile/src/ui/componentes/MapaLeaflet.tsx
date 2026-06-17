import React, { useRef } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { cores, raio, espaco } from '../tema';

/**
 * Mapa Leaflet em WebView (sem Google Maps). Mostra/edita o ponto do endereço:
 * toque ou arraste o pino para definir lat/lng; o botão usa o GPS do aparelho.
 */
export function MapaLeaflet({ latitude, longitude, onChange, altura = 220 }: {
  latitude?: number; longitude?: number; onChange?: (lat: number, lng: number) => void; altura?: number;
}) {
  const ref = useRef<WebView>(null);
  const lat = latitude ?? -23.55, lng = longitude ?? -46.63;

  const html = `<!DOCTYPE html><html><head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
    <style>html,body,#map{height:100%;margin:0}</style></head>
    <body><div id="map"></div>
    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
    <script>
      var map = L.map('map').setView([${lat}, ${lng}], 16);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);
      var marker = L.marker([${lat}, ${lng}], { draggable: true }).addTo(map);
      function envia(ll){ window.ReactNativeWebView.postMessage(JSON.stringify({lat: ll.lat, lng: ll.lng})); }
      map.on('click', function(e){ marker.setLatLng(e.latlng); envia(e.latlng); });
      marker.on('dragend', function(){ envia(marker.getLatLng()); });
      window.definirPonto = function(la, ln){ marker.setLatLng([la,ln]); map.setView([la,ln],16); };
    </script></body></html>`;

  async function usarMinhaLocalizacao() {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return;
    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
    const { latitude: la, longitude: ln } = pos.coords;
    ref.current?.injectJavaScript(`window.definirPonto(${la}, ${ln}); true;`);
    onChange?.(la, ln);
  }

  return (
    <View style={{ gap: espaco.sm }}>
      <View style={{ height: altura, borderRadius: raio.md, overflow: 'hidden', borderWidth: 1, borderColor: cores.borda }}>
        <WebView
          ref={ref} originWhitelist={['*']} source={{ html }}
          onMessage={(ev) => { const { lat, lng } = JSON.parse(ev.nativeEvent.data); onChange?.(lat, lng); }}
        />
      </View>
      <TouchableOpacity onPress={usarMinhaLocalizacao} activeOpacity={0.7}
        style={{ flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: cores.primaria, borderRadius: raio.md, paddingVertical: 12 }}>
        <Ionicons name="locate" size={18} color={cores.primaria} />
        <Text style={{ color: cores.primaria, fontWeight: '600' }}>Usar minha localização</Text>
      </TouchableOpacity>
      {latitude != null && (
        <Text style={{ color: cores.suave, fontSize: 12, textAlign: 'center' }}>
          {Number(latitude).toFixed(5)}, {Number(longitude).toFixed(5)}
        </Text>
      )}
    </View>
  );
}
