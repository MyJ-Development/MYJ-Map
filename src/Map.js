import React, { useState, useEffect, useCallback, useRef } from "react";
import { Map, Marker, Polyline, GoogleApiWrapper } from "google-maps-react";
import axios from 'axios';
import { Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, Button} from '@material-ui/core';
import withReactContent from 'sweetalert2-react-content';
import Swal from 'sweetalert2';
import _ from 'lodash';
import Switch from '@mui/material/Switch';
import FormGroup from '@mui/material/FormGroup';
import FormControlLabel from '@mui/material/FormControlLabel';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import Select from '@mui/material/Select';
import Backdrop from '@mui/material/Backdrop';
import CircularProgress from '@mui/material/CircularProgress';
import Input from "@material-ui/core/Input";
import { Table, TableBody, TableCell, TableContainer, TableRow, Paper } from '@material-ui/core';
const API_URL = process.env.REACT_APP_API_URL;
const apiKey = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;


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
  const inputRef = useRef();
  const uniqueTypes = [...new Set(markerTypes.map(type => type && type.includes('RUTA SIN TITULO') ? 'RUTA SIN TITULO' : type))];
  const [menuVisible, setMenuVisible] = useState(true);
  const [measurementMode, setMeasurementMode] = useState(false);
  const [measurementDistance, setMeasurementDistance] = useState(0);
  const [measurementMarkers, setMeasurementMarkers] = useState([]);
  const [temporaryMarkers, setTemporaryMarkers] = useState([]);
  const [measurementPath, setMeasurementPath] = useState([]);
  const [measurementPolyline, setMeasurementPolyline] = useState(null);

  useEffect(() => {
    loadMarkersFromAPI();
    loadMarkerTypesFromAPI();
  }, []);
  const handleSave = () => {
    const newDescription = inputRef.current.value;
    let markerToUpdate = ""
    markerToUpdate = { ...selectedMarker, description: newDescription };
    handleSaveChanges(markerToUpdate);
    handleClose();
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
  
  const handleHideAll = () => {
    const newVisibility = { ...markerVisibility };
    for (let type in newVisibility) {
      newVisibility[type] = false;
    }
    setMarkerVisibility(newVisibility);
  };
  useEffect(() => {
    const visibility = {};
    markerTypes.forEach(type => {
      visibility[type] = true;
    });
    setMarkerVisibility(visibility);
  }, [markerTypes]);

  const loadMarkersFromAPI = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_URL}/markers`);
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
      const response = await axios.get(`${API_URL}/marker-types`);
      const types = response.data;
      setMarkerTypes(types);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const updateMarkerInAPI = async marker => {
    setLoading(true);
    try {
      await axios.put(`${API_URL}/markers/${marker.id}`, marker);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const deleteMarkerInAPI = async id => {
    setLoading(true);
    try {
      await axios.delete(`${API_URL}/markers/${id}`);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };
  const handleSaveChanges = async (markerToUpdate) => {
    try {
      console.log(markerToUpdate);
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
            console.log(i);
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
  }, [modifiedMarkers]);

  const handleMarkerTypeChange = event => {
    setSelectedMarkerType(event.target.value);
  };

  const handleMarkerVisibilityChange = (type, e) => {
    if (type === 'RUTA SIN TITULO') {
      const newVisibility = { ...markerVisibility };
      for (let markerType in newVisibility) {
        if (markerType?.includes('RUTA SIN TITULO')) {
          newVisibility[markerType] = e.target.checked;
        }
      }
      setMarkerVisibility(newVisibility);
    } else {
      setMarkerVisibility({
        ...markerVisibility,
        [type]: e.target.checked,
      });
    }
  };

  const getRouteCoordinates = type => {
    const routeMarkers = markers.filter(marker => marker.type === type);
    return routeMarkers.map(marker => ({
      lat: marker.lat,
      lng: marker.lng,
    }));
  };

  const handleAddMarkerType = () => {
    const typeName = prompt("Ingrese el nombre del nuevo tipo de marcador:");

    if (!typeName || typeName.trim() === "") {
      return;
    }

    setMarkerTypes(prevTypes => {
      const newType = typeName;
      return [...prevTypes, newType];
    });
  };


  const mapStyles = {
    width: "100%",
    height: "800px"
  };

  return (
    <div>

      <Map
  google={google}
  zoom={15}
  style={mapStyles}
  initialCenter={{ lat: -33.367613, lng: -70.738301 }}
  onClick={handleMapClick}
>
<div style={{
    position: 'absolute',
    top: '1px',
    left: '200px',
    backgroundColor: 'white',
    padding: '10px',
    borderRadius: '5px',
  }}>
  <Button variant="outlined"  onClick={() => setMenuVisible(!menuVisible)}>Ocultar/Mostrar</Button>
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
    maxHeight: '600px',
    overflowY: 'auto'
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
      <FormControl fullWidth>
      <InputLabel >Seleccionar tipo de marcador</InputLabel>
      <Select
        autoWidth={true}
        value={selectedMarkerType}
        onChange={handleMarkerTypeChange}
        disabled={!editMode}
      >
        {markerTypes.map(type => (
          !type?.includes('RUTA SIN TITULO') && <MenuItem key={type} value={type}>{type}</MenuItem>
        ))}
      </Select>
    </FormControl>
    <div style={{ padding: "5px"}}>
      <Button variant="contained" onClick={handleAddMarkerType}>Agregar Tipo de Marcador</Button>
    </div>
    <div style={{ padding: "5px"}}>
      <Button variant="contained" onClick={handleHideAll} style={{ padding: '3px' }}>Ocultar todos</Button>
    </div>
    <TableContainer component={Paper}>
      <Table>
        <TableBody>
          {
            uniqueTypes.map(uniqueType => (
              <TableRow key={uniqueType}>
                <TableCell>{uniqueType}:</TableCell>
                <TableCell>
                  <input
                    type="checkbox"
                    checked={markerVisibility[uniqueType]}
                    onChange={e => handleMarkerVisibilityChange(uniqueType, e)}
                  />
                </TableCell>
              </TableRow>
            ))
          }
        </TableBody>
      </Table>
    </TableContainer>
  </div> )}
  
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
      PaperProps={{ style: { backgroundColor: '#f5f5f5', borderRadius: 12} }}
    >
      <DialogTitle style={{ textAlign: 'center' }}>{selectedMarker?.type}</DialogTitle>
      <DialogContent>
        {editMode ? (
            <Input
            autoFocus
            fullWidth
            defaultValue={selectedMarker?.description}
            inputRef={inputRef}
          />
        ) : (
          <DialogContentText>{selectedMarker?.description}</DialogContentText>
        )}
      </DialogContent>
      <DialogActions style={{justifyContent:"center"}}>
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
