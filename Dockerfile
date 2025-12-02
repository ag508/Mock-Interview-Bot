# Stage 1: Build
FROM node:20-alpine as build
WORKDIR /app
COPY interview-bot/package*.json ./
RUN npm install
COPY interview-bot/ .
RUN npm run build

# Stage 2: Serve
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]