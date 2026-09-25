import React from 'react';
import NextImage, { ImageProps as NextImageProps } from 'next/image';

type ImageProps = NextImageProps & {
    isWebp?: boolean;
};

const Image = React.forwardRef<HTMLImageElement, ImageProps>(
    ({ src, quality = 90, isWebp = true, ...props }, ref) => {
        const source =
            `${src?.toString()}?q=${quality}` +
            (isWebp ? '&fm=webp' : '');
        return <NextImage {...props} ref={ref} src={source} />;
    }
);

Image.displayName = 'Image';

const ImageDefault = React.forwardRef<
    HTMLImageElement,
    React.DetailedHTMLProps<
        React.ImgHTMLAttributes<HTMLImageElement>,
        HTMLImageElement
    >
>((props, ref) => {
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    return <img {...props} src={props.src} ref={ref} />;
});

ImageDefault.displayName = 'ImageDefault';

export default Object.assign(Image, { Default: ImageDefault });
