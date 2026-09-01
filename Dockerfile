FROM apify/actor-node:20

COPY package.json pnpm-lock.yaml ./
RUN corepack enable \
    && corepack prepare pnpm@10.34.5 --activate \
    && pnpm install --prod --frozen-lockfile \
    && echo "Installed NPM packages:"

COPY . ./

CMD ["npm", "start", "--silent"]
