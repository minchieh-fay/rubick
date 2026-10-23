FROM rust:1.89-bookworm AS build
WORKDIR /build
COPY . .
RUN cargo build --release -p ssh

FROM debian:bookworm-slim
WORKDIR /opt/ssh
COPY --from=build /build/target/release/ssh /opt/ssh/ssh-service
ENTRYPOINT ["/opt/ssh/ssh-service"]
