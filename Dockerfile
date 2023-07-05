# Base image
FROM node:14 as build

# Establece el directorio de trabajo
WORKDIR /app

# Copia los archivos de package.json y package-lock.json
COPY package*.json ./

# Instala las dependencias
RUN npm install

# Copia los archivos del proyecto
COPY . .

# Agrega las variables de entorno
ARG REACT_APP_GOOGLE_MAPS_API_KEY
ARG REACT_APP_API_URL
ENV REACT_APP_GOOGLE_MAPS_API_KEY=$REACT_APP_GOOGLE_MAPS_API_KEY
ENV REACT_APP_API_URL=$REACT_APP_API_URL

# Construye la aplicación de React
RUN npm run build

# Imagen base para el despliegue
FROM nginx:1.21-alpine

# Copia los archivos de la construcción de la aplicación de React al directorio de Nginx
COPY --from=build /app/build /usr/share/nginx/html

# Expone el puerto 80
EXPOSE 80

# Comando para iniciar Nginx
CMD ["nginx", "-g", "daemon off;"]
