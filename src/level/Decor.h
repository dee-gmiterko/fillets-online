#ifndef HEADER_DECOR_H
#define HEADER_DECOR_H

class View;

#include "/home/ienze/git/emsdk/emscripten/1.38.16/system/include/SDL/SDL.h"

/**
 * Screen decoration.
 */
class Decor {
    public:
        virtual ~Decor() {}
        virtual void drawOnScreen(const View *view, SDL_Surface *screen) = 0;
};

#endif
