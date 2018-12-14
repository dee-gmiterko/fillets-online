#ifndef HEADER_DRAWABLE_H
#define HEADER_DRAWABLE_H

#include "NoCopy.h"

#include "/home/ienze/git/emsdk/emscripten/1.38.16/system/include/SDL/SDL.h"

/**
 * Interface - draw able object.
 */
class Drawable : public NoCopy {
    public:
        virtual ~Drawable() {}
        virtual void drawOn(SDL_Surface *screen) = 0;
};

#endif
