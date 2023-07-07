import React, { useState, useEffect, useCallback, useRef } from "react";
import { Map, Marker, Polyline, GoogleApiWrapper } from "google-maps-react";
import axios from 'axios';
import { Dialog,DialogTitle, DialogContent, DialogContentText, DialogActions, Button } from '@material-ui/core';
// import { Button } from '@material-ui/core';
import withReactContent from 'sweetalert2-react-content';
import Swal from 'sweetalert2';
import _ from 'lodash';
import Switch from '@mui/material/Switch';
import FormGroup from '@mui/material/FormGroup';
import FormControlLabel from '@mui/material/FormControlLabel';
import Backdrop from '@mui/material/Backdrop';
import CircularProgress from '@mui/material/CircularProgress';
import Input from "@material-ui/core/Input";
import { TreeSelect } from 'primereact/treeselect';
import 'primereact/resources/themes/lara-light-indigo/theme.css';
import 'primereact/resources/primereact.css';
import 'primeicons/primeicons.css';
import 'primeflex/primeflex.css';
import { InputText } from 'primereact/inputtext';
import { Checkbox } from 'primereact/checkbox';
// import { Dialog } from "primereact/dialog";

const API_URL = process.env.REACT_APP_API_URL;
const apiKey = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;
const MAX_ATTEMPTS = 3;

function MapContainer({ google }) {

  const [markers, setMarkers] = useState([]);
  const [editMode, setEditMode] = useState(false);
  const [selectedMarkerType, setSelectedMarkerType] = useState("");
  const [markerVisibility, setMarkerVisibility] = useState({});
  const [selectedMarker, setSelectedMarker] = useState(null);
  const [open, setOpen] = useState(false);
  const MySwal = withReactContent(Swal);
  const [markerTypes, setMarkerTypes] = useState([]);
  const [modifiedMarkers, setModifiedMarkers] = useState([]);
  const [loading, setLoading] = useState(false);
  const inputRefDescription = useRef();
  const [menuVisible, setMenuVisible] = useState(true);
  const [measurementMode, setMeasurementMode] = useState(false);
  const [measurementDistance, setMeasurementDistance] = useState(0);
  const [measurementMarkers, setMeasurementMarkers] = useState([]);
  const [temporaryMarkers, setTemporaryMarkers] = useState([]);
  const [measurementPath, setMeasurementPath] = useState([]);
  const [measurementPolyline, setMeasurementPolyline] = useState(null);
  const [newMarkerType, setNewMarkerType] = useState('');
  const [isSubroute, setIsSubroute] = useState(false);
  const [parentRoute, setParentRoute] = useState('');
  const [subrouteCounters, setSubrouteCounters] = useState({});
  const [allVisible, setAllVisible] = useState(true);
  const [treeData, setTreeData] = useState(null);
  const [selectedNodeKeys, setSelectedNodeKeys] = useState(null);
  const [currentLocation, setCurrentLocation] = useState(null);
  //const first load
  const [firstLoad, setFirstLoad] = useState(true);
  const [updateMarkerType, setUpdateMarkerType] = useState(""); 

  useEffect(() => {
    if (markerTypes.length > 0) {
      const newTreeData = transformMarkersToTreeData(markerTypes);
      setTreeData(newTreeData);
    }
  }, [markerTypes]);
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setCurrentLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        (error) => {
          // handle error
          console.log(error);
        }
      );
    } else {
      alert("La geolocalización no es compatible con este navegador.");
    }
  }, []);
  useEffect(() => {
    loadMarkersFromAPI();
    loadMarkerTypesFromAPI();
    // eslint-disable-next-line
  }, []);
  const handleSave = () => {
    const newDescription = inputRefDescription.current.value;
    let markerToUpdate = ""
    markerToUpdate = { ...selectedMarker, description: newDescription, type: updateMarkerType };
    handleSaveChanges(markerToUpdate);
    handleClose();
    setUpdateMarkerType("");
  };
  const calculateDistance = (point1, point2) => {
    const lat1 = point1.lat();
    const lng1 = point1.lng();
    const lat2 = point2.lat();
    const lng2 = point2.lng();

    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = 6371 * c; // Radio de la Tierra en kilómetros

    return distance;
  };

  const handleToggleVisibility = () => {
    const newVisibility = { ...markerVisibility };
    for (let type in newVisibility) {
      newVisibility[type] = allVisible; // set visibility according to the allVisible state
    }
    setMarkerVisibility(newVisibility);
    setAllVisible(!allVisible); // toggle the allVisible state
    if (!allVisible) {
      setSelectedNodeKeys(null);
    } else {
      let auxAllKeys = getAllKeys(treeData)
      let aux = {}
      auxAllKeys.forEach((key) => {
        aux[key] = { checked: true }
      });
      setSelectedNodeKeys(aux);
    }
  };
  useEffect(() => {
    const visibility = {};
    if(firstLoad){
      markerTypes.forEach(type => {
        visibility[type] = false;
      });
      setMarkerVisibility(visibility);
      setFirstLoad(false);
    } else {
      markerTypes.forEach(type => {
        visibility[type] = false;
      });
      setMarkerVisibility(visibility);
    }
    // eslint-disable-next-line
  }, [markerTypes]);

  const retryRequest = async (requestFn, ...args) => {
    let attempts = 0;
    let error;
    while (attempts < MAX_ATTEMPTS) {
      try {
        return await requestFn(...args); // Intenta la petición
      } catch (err) {
        attempts++; // Incrementa el conteo de intentos
        error = err;
      }
    }
    // Si todos los intentos fallaron, lanza el último error capturado
    throw error;
  };
  const getAllKeys = (treeData) => {
    let keys = [];
    treeData.forEach((node) => {
      keys.push(node.key);
      if (node.children) {
        keys = [...keys, ...getAllKeys(node.children)];
      }
    });
    return keys;
  };
  const loadMarkersFromAPI = async () => {
    setLoading(true);
    try {
      const response = await retryRequest(() => axios.get(`${API_URL}/markers`));
      const markers = response.data;
      markers.forEach(marker => {
        marker.draggable = false;
      });
      setMarkers(markers);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadMarkerTypesFromAPI = async () => {
    setLoading(true);
    try {
      const types = await retryRequest(() => axios.get(`${API_URL}/marker-types`));
      const newCounters = {};
      types.data.forEach((type) => {
        const match = type.match(/(.*?)_sub_(\d+)$/);

        // Si es una subruta
        if (match) {
          const route = match[1];
          const count = parseInt(match[2]);

          // Si es la primera subruta para esta ruta principal o es más grande que el contador existente, actualiza el contador
          if (!newCounters[route] || count > newCounters[route]) {
            newCounters[route] = count;
          }
        }
      });
      setSubrouteCounters(newCounters);
      setMarkerTypes(types.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };
  const updateMarkerInAPI = async marker => {
    setLoading(true);
    try {
      await retryRequest((marker) => axios.put(`${API_URL}/markers/${marker.id}`, marker), marker);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const deleteMarkerInAPI = async id => {
    setLoading(true);
    try {
      await retryRequest((id) => axios.delete(`${API_URL}/markers/${id}`), id);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };
  const handleSaveChanges = async (markerToUpdate) => {
    try {
      await updateMarkerInAPI(markerToUpdate);
    } catch (err) {
      console.error(err);
    }
    setMarkers(prevMarkers =>
      prevMarkers.map(m => (m.id === markerToUpdate.id ? markerToUpdate : m))
    );

    setSelectedMarker(null);
    setOpen(false);
  };
  const handleClickOpen = marker => {
    if (marker) {
      const updatedMarker = { ...marker, draggable: true }; // Invierte el valor de la propiedad draggable
      setSelectedMarker(updatedMarker);
      setOpen(true);
      setMarkers(prevMarkers =>
        prevMarkers.map(m =>
          m.id === marker.id ? updatedMarker : m // Actualiza el marcador en el arreglo de marcadores
        )
      );
    }
  };

  const createMarkerInAPI = async (markerToCreate) => {
    setLoading(true);
    try {
      for (let i of markerToCreate) {
        const response = await axios.post(`${API_URL}/markers`, i);
        i.id = response.data.id;
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setOpen(false);
  };

  const removeMarker = () => {
    const newMarkers = markers.filter(marker => marker.id !== selectedMarker.id);
    setMarkers(newMarkers);
    setSelectedMarker(null);
    deleteMarkerInAPI(selectedMarker.id);
  };

  const handleDeleteMarker = () => {
    MySwal.fire({
      title: '¿Estás seguro de que deseas eliminar este marcador?',
      showCancelButton: true,
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'No, cancelar',
    }).then((result) => {
      if (result.isConfirmed) {
        setOpen(false);
        removeMarker();
      }
    });
  };

  const handleMapClick = (mapProps, map, clickEvent) => {
    if (measurementMode) {
      const { latLng } = clickEvent;
      const lastMarker = measurementMarkers[measurementMarkers.length - 1];
      if (lastMarker) {
        const distance = calculateDistance(lastMarker.latLng, latLng);
        setMeasurementDistance(prevDistance => prevDistance + distance);
      }
      setMeasurementMarkers(prevMarkers => [...prevMarkers, { latLng }]);

      // Crear marcador temporal
      const temporaryMarker = new google.maps.Marker({
        position: latLng,
        map: map,
        icon: {
          url: "https://maps.google.com/mapfiles/ms/icons/green-dot.png",
          scaledSize: new window.google.maps.Size(20, 20),
        },
      });
      setTemporaryMarkers(prevMarkers => [...prevMarkers, temporaryMarker]);
      setMeasurementPath(prevPath => [...prevPath, latLng]);

      // Dibujar polilínea
      if (measurementPolyline) {
        measurementPolyline.setPath(measurementPath.concat(latLng));
      } else {
        const newPolyline = new google.maps.Polyline({
          path: measurementPath.concat(latLng),
          geodesic: true,
          strokeColor: "#FF0000",
          strokeOpacity: 1.0,
          strokeWeight: 2,
        });
        newPolyline.setMap(map);
        setMeasurementPolyline(newPolyline);
      }
    } else if (editMode && selectedMarkerType) {
      const { latLng } = clickEvent;
      const lat = latLng.lat();
      const lng = latLng.lng();
      const newMarker = {
        lat,
        lng,
        type: selectedMarkerType,
        draggable: true,
      };
      setMarkers(prevMarkers => [...prevMarkers, newMarker]);
      setModifiedMarkers(prevModifiedMarkers => [...prevModifiedMarkers, newMarker]);
    }

  };

  const handleMarkerDragEnd = useCallback((marker, mapProps, map, dragEvent) => {
    const { latLng } = dragEvent;
    const lat = latLng.lat();
    const lng = latLng.lng();
    const updatedMarker = {
      ...marker,
      lat,
      lng
    };

    setMarkers(prevMarkers => prevMarkers.map(m => m.id === marker.id ? updatedMarker : m));

    if (!modifiedMarkers.some(m => m.id === marker.id)) {
      setModifiedMarkers(prevModifiedMarkers => [...prevModifiedMarkers, updatedMarker]);
    } else {
      setModifiedMarkers(prevModifiedMarkers => prevModifiedMarkers.map(m => m.id === marker.id ? updatedMarker : m));
    }
  }, [modifiedMarkers]);
  const debouncedHandleMarkerDragEnd = _.debounce(handleMarkerDragEnd, 200);
  useEffect(() => {
    setMeasurementDistance(0);
    setMeasurementMarkers([]);
    temporaryMarkers.forEach(marker => marker.setMap(null));
    setTemporaryMarkers([]);
    setMeasurementPath([]);
    measurementPolyline?.setMap(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [measurementMode]);


  const toggleEditMode = useCallback(() => {
    let markerToCreate = [];
    setEditMode(prevEditMode => {
      if (prevEditMode) {
        setLoading(true);
        modifiedMarkers.forEach(marker => {
          if (marker.id) {
            updateMarkerInAPI(marker);
          } else {
            markerToCreate.push(marker);
          }
        });
        if (markerToCreate?.length > 0) {
          createMarkerInAPI(markerToCreate);
        };
        setModifiedMarkers([]);
        setLoading(false);
      }
      return !prevEditMode;
    });
    // eslint-disable-next-line
  }, [modifiedMarkers]);
  const handleMarkerTypeChange = event => {
    setSelectedMarkerType(event.target.value);
  };

  useEffect(() => {
    const visibilityUpdates = { ...markerVisibility };

    if (selectedNodeKeys) {
      for (let key of Object.keys(markerVisibility)) {
        let auxKey = key.toString();
        visibilityUpdates[key] = selectedNodeKeys[auxKey]?.checked;
      }
    }
    setMarkerVisibility(visibilityUpdates);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedNodeKeys]);

  const getRouteCoordinates = type => {
    const routeMarkers = markers.filter(marker => marker.type === type);
    return routeMarkers.map(marker => ({
      lat: marker.lat,
      lng: marker.lng,
    }));
  };
  const handleAddMarkerType = () => {
    if (isSubroute && !parentRoute) {
      return;
    }
    if (!isSubroute && (!newMarkerType || newMarkerType.trim() === "")) {
      return;
    }

    setMarkerTypes(prevTypes => {
      let newType;
      if (isSubroute) {
        // Obten el contador actual para la ruta principal, o establecelo en 1 si no existe
        const currentCounter = subrouteCounters[parentRoute] ? subrouteCounters[parentRoute] + 1 : 1;
        // Actualiza el contador en el estado
        setSubrouteCounters({
          ...subrouteCounters,
          [parentRoute]: currentCounter
        });

        // Genera el nuevo nombre de tipo
        newType = `${parentRoute}_sub_${currentCounter}`;
      } else {
        newType = newMarkerType;
      }

      return [...prevTypes, newType];
    });
    setNewMarkerType('');
    setIsSubroute(false);
    setParentRoute('');
  };

  const transformMarkersToTreeData = (markers) => {
    // Clasifica los marcadores en marcadores principales y subrutas
    const mainMarkers = markers?.filter(marker => !/_sub_\d+$/.test(marker));
    const subRoutes = markers?.filter(marker => /_sub_\d+$/.test(marker));
  
    // Remove duplicates from subroutes and main markers
    const uniquesubRoutes = [...new Set(subRoutes)];
    const uniquemainMarkers = [...new Set(mainMarkers)];
  
    // Separar rutas sin título
    const titledRoutes = uniquemainMarkers.filter(marker => !marker.includes('RUTA SIN TITULO'));
    const untitledRoutes = uniquemainMarkers.filter(marker => marker.includes('RUTA SIN TITULO'));
  
    // Agregar rutas sin título como subrutas de 'RUTA SIN TITULO'
    let sinTituloSubRoutes = uniquesubRoutes.filter(subroute => subroute.includes('RUTA SIN TITULO'));
    sinTituloSubRoutes = sinTituloSubRoutes.concat(untitledRoutes);
  
    return titledRoutes.map((marker, markerIndex) => {
      // Para cada marcador principal, busca sus subrutas
      const markerSubRoutes = uniquesubRoutes.filter(subroute => subroute.startsWith(marker));
  
      return {
        key: `${marker}`,
        label: marker,
        data: `${marker} Folder`,
        icon: "pi pi-circle-fill",
        children: markerSubRoutes.map((subroute, subrouteIndex) => ({
          key: `${subroute}`,
          label: subroute,
          data: `${subroute} Folder`,
          icon: 'pi pi-fw pi-cog' // El icono puede ser personalizado según tus necesidades.
        }))
      }
    }).concat([{
      key: 'RUTA SIN TITULO',
      label: 'RUTA SIN TITULO',
      data: 'RUTA SIN TITULO Folder',
      icon: "pi pi-circle-fill",
      children: sinTituloSubRoutes.map((subroute, subrouteIndex) => ({
        key: `${subroute}`,
        label: subroute,
        data: `${subroute} Folder`,
        icon: 'pi pi-fw pi-cog' // El icono puede ser personalizado según tus necesidades.
      }))
    }]);
  };
  

  const mapStyles = {
    width: "100%",
    height: "100vh"
  };

  return (
    <div>
      <Map
        google={google}
        zoom={15}
        style={mapStyles}
        initialCenter={currentLocation || { lat: -33.367613, lng: -70.738301 }}
        onClick={handleMapClick}
      > 
        {currentLocation && (
  <Marker
    key="currentLocation"
    position={currentLocation}
    icon={{
      url: "https://cdn-icons-png.flaticon.com/128/4436/4436638.png",
      scaledSize: new window.google.maps.Size(40, 40),
    }}
  />
)}
        <div style={{
          position: 'absolute',
          top: '1px',
          left: '200px',
          backgroundColor: 'white',
          padding: '10px',
          borderRadius: '5px',
          border: '1px solid black'
        }}>
          <Button variant="outlined" onClick={() => setMenuVisible(!menuVisible)}>Ocultar/Mostrar</Button>
          <Button variant="contained" onClick={() => setMeasurementMode(!measurementMode)}>
            {measurementMode ? 'Terminar medición' : 'Iniciar medición'}
          </Button>
          {measurementMode && (
            <div>
              <div>Distancia acumulada: {measurementDistance.toFixed(2)} km</div>
            </div>
          )}
        </div>

        {menuVisible && (
          <div style={{
            position: 'absolute',
            top: '100px',
            left: '15px',
            backgroundColor: 'white',
            padding: '10px',
            borderRadius: '5px',
            maxHeight: '400px',
            overflowY: 'auto',
            border: '1px solid black'
          }}>

            <FormGroup>
              <FormControlLabel
                control={
                  <Switch
                    checked={editMode}
                    onChange={toggleEditMode}
                    color="primary"
                  />
                }
                label={editMode ? "Guardar" : "Modo Edición"}
              />
            </FormGroup>
            <TreeSelect disabled={!editMode} value={selectedMarkerType} onChange={(event) => handleMarkerTypeChange(event)} options={treeData}
              filter className="md:w-20rem w-full" placeholder="Marcadores"></TreeSelect>

            <div style={{ padding: "5px" }} className="flex align-items-center">
              <Checkbox
                disabled={!editMode}
                checked={isSubroute}
                onChange={(e) => setIsSubroute(e.target.checked)}
              >
              </Checkbox>
              <label style={{ padding: "5px" }}>Subruta?</label>
              {isSubroute ? (
                <TreeSelect disabled={!editMode} value={parentRoute} onChange={(event) => setParentRoute(event.target.value)} options={treeData}
                  filter className="md:w-20rem w-full" placeholder="Ruta principal"></TreeSelect>
              ) : (
                <InputText
                  placeholder="Nombre marcador"
                  value={newMarkerType}
                  disabled={!editMode}
                  onChange={(e) => setNewMarkerType(e.target.value)}
                />
              )}
              <div style={{ padding: "5px" }}>
                <Button disabled={!editMode} variant="contained" onClick={handleAddMarkerType}>
                  Agregar Tipo de Marcador
                </Button>
              </div>
            </div>
            <div style={{ padding: "5px" }}>
              <Button variant="contained" onClick={handleToggleVisibility} style={{ padding: '3px' }}>
                {allVisible ? 'Mostrar todos' : 'Ocultar todos'}
              </Button>
            </div>
            {treeData && <TreeSelect
              value={selectedNodeKeys}
              onChange={(e) => setSelectedNodeKeys(e.value)}
              options={treeData}
              filter
              metaKeySelection={false}
              selectionMode="checkbox"
              className="md:w-20rem w-full"
              placeholder="Ocultar/Mostrar"

            />}

          </div>)}

        {markers.map((marker, index) => {
          const isVisible = markerVisibility[marker.type];
          if (!isVisible) return null;

          return (
            <Marker
              key={marker.id}
              id={marker.id}
              position={{ lat: marker.lat, lng: marker.lng }}
              icon={{
                url:
                  marker.type === "MUFA"
                    ? "https://maps.google.com/mapfiles/ms/icons/red-dot.png"
                    : marker.type === "NAP"
                      ? "https://maps.google.com/mapfiles/ms/icons/yellow-dot.png"
                      : "https://maps.google.com/mapfiles/ms/icons/blue-dot.png",
                scaledSize: new window.google.maps.Size(20, 20),  // Este es tu valor por defecto
              }}
              draggable={editMode && marker.draggable} // Toma en cuenta el estado de "draggable" del marcador
              onClick={() => handleClickOpen(marker)}
              onDragend={(mapProps, map, dragEvent) =>
                debouncedHandleMarkerDragEnd(marker, mapProps, map, dragEvent)
              }
            ></Marker>
          );
        })}
        {measurementMode && temporaryMarkers.map((marker, index) => (
          <Marker
            key={index}
            position={marker.getPosition()}
            icon={{
              url: "https://maps.google.com/mapfiles/ms/icons/green-dot.png",
              scaledSize: new window.google.maps.Size(20, 20),
            }}
          />
        ))}
        {markerTypes.map(type => {
          if (markerVisibility[type] && type !== "MUFA" && type !== "NAP") {
            return (
              <Polyline
                key={type}
                path={getRouteCoordinates(type)}
                strokeColor="#0000FF"
                strokeOpacity={1}
                strokeWeight={1}
              />
            );
          }
          return null;
        })}

        <Dialog
          open={open}
          onClose={handleClose}
          PaperProps={{ style: { backgroundColor: '#f5f5f5', borderRadius: 12 } }}
        >
          <DialogTitle style={{ textAlign: 'center' }}>{selectedMarker?.type}</DialogTitle>
          <DialogContent>
            {editMode ? (
              <>
            <TreeSelect disabled={!editMode} value={updateMarkerType} onChange={(event) => setUpdateMarkerType(event.target.value)} options={treeData}
              filter className="md:w-20rem w-full" placeholder="Cambiar tipo de marcador"></TreeSelect>
              <Input
                autoFocus
                fullWidth
                defaultValue={selectedMarker?.description}
                inputRef={inputRefDescription}
              />
              </>
            ) : (
              <DialogContentText>{selectedMarker?.description}</DialogContentText>
            )}
          </DialogContent>
          <DialogActions style={{ justifyContent: "center" }}>
            {editMode && (
              <Button onClick={handleSave} color="primary" variant="contained">
                Guardar
              </Button>
            )}
            {editMode && (
              <Button onClick={handleDeleteMarker} color="secondary" variant="contained">
                Eliminar Marcador
              </Button>
            )}
          </DialogActions>
        </Dialog>
      </Map>
      <Backdrop
        sx={{ color: '#fff', zIndex: (theme) => theme.zIndex.drawer + 1 }}
        open={loading}
      >
        <CircularProgress color="inherit" />
      </Backdrop>
    </div>
  );
}

export default GoogleApiWrapper({
  apiKey: apiKey
})(MapContainer);