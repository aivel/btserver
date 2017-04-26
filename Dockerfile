FROM node:7

EXPOSE 3309

COPY ./ /srv
RUN cd /srv && npm install

CMD cd /srv && node entry.js
