FROM node:22 AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
# In production the backend is reached same-origin through the gateway; local builds without args keep the localhost defaults
ARG VITE_DATA_URL
ARG VITE_ANALYST_URL
# Previews are built with VITE_BASE=/preview/<slug>/ (see deploy/deploy.sh preview); production uses "/"
ARG VITE_BASE=/
ENV VITE_DATA_URL=${VITE_DATA_URL} VITE_ANALYST_URL=${VITE_ANALYST_URL} VITE_BASE=${VITE_BASE}
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
