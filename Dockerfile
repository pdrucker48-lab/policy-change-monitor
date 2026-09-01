FROM apify/actor-node:20

COPY package.json pnpm-lock.yaml ./
RUN corepack enable \
    && pnpm install --prod --frozen-lockfile \
    && echo "Installed NPM packages:"

COPY . ./

CMD ["npm", "start", "--silent"]
