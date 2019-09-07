FROM debian:stable-slim

ARG VERSION=0.58.1
ENV PACKAGE hugo_extended_${VERSION}_Linux-64bit.tar.gz

ADD https://github.com/gohugoio/hugo/releases/download/v${VERSION}/${PACKAGE} /tmp
RUN tar xzvf "/tmp/${PACKAGE}" hugo \
	&& rm -fr "/tmp/${PACKAGE}"

ENV PATH="/:${PATH}"

WORKDIR /site
