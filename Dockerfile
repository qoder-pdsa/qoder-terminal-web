FROM node:22 AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
# 生产环境经网关同源访问后端；本地开发不传参时沿用 localhost 默认值
ARG VITE_DATA_URL
ARG VITE_ANALYST_URL
ENV VITE_DATA_URL=${VITE_DATA_URL} VITE_ANALYST_URL=${VITE_ANALYST_URL}
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
